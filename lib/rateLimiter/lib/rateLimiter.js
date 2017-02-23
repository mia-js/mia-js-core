/**
 * @description :: Outputs the response as JSON document
 */
var _ = require('lodash')
    , IP = require('ip')
    , Q = require('q')
    , Logger = require('./../../logger')
    , Shared = require('./../../shared')
    , Translator = require('./../../translator')
    , Encryption = require("./../../utils").Encryption;

function thisModule() {
    var self = this;

    // Get time left in seconds till rate limit reset
    var _getTimeLeftTillReset = function (timeInterval) {
        return _calculateCurrentTimeInterval(timeInterval) - Math.round(Date.now() / 1000);
    };

    // Calculate current time interval slot
    var _calculateCurrentTimeInterval = function (range) {
        var coeff = 1000 * 60 * range;
        return new Date(Math.ceil(new Date(Date.now()).getTime() / coeff) * coeff).getTime() / 1000;
    };

    // Check global rate limits per ip
    var _rateLimit = function (key, timeInterval, limit) {
        //Validate rate limiter settings
        if (!_.isNumber(timeInterval) || parseInt(timeInterval) <= 0 || !_.isNumber(limit) || parseInt(limit) <= 0) {
            return Q.reject();
        }
        var cacheKey = Encryption.md5("MiaJSRateLimit" + key + _calculateCurrentTimeInterval(timeInterval));
        return _validateRateLimit(cacheKey, timeInterval, limit).then(function (value) {
            return Q({
                limit: limit,
                remaining: limit - value,
                timeInterval: timeInterval,
                timeTillReset: _getTimeLeftTillReset(timeInterval)
            });
        });
    };

    // Validate and increase current rate limit in memcache
    var _validateRateLimit = function (key, intervalSize, limit) {
        var deferred = Q.defer()
            , memcached = Shared.memcached();
        if (!memcached) {
            deferred.reject();
        }
        else {
            //Get current rate for ip
            memcached.get(key, function (err, value) {
                if (err) {
                    //Allow access as failover
                    Logger.warn("Rate limit set but memcached error, allow access without limit", err);
                    deferred.reject();
                }
                else if (_.isUndefined(value)) {
                    memcached.set(key, 1, 60 * intervalSize, function (err) {
                        if (err) {
                            Logger.warn("Rate limit set but memcached error, allow access without limit", err);
                        }
                    });
                    deferred.resolve(1);
                }
                else {
                    //Do not increase rate counter if exceeded anyway
                    if (value < limit) {
                        // Increase rate counter by 1
                        memcached.incr(key, 1, function (err) {
                            if (err) {
                                Logger.warn("Rate limit set but memcached error, allow access without limit", err);
                            }
                        });
                    }
                    deferred.resolve(value + 1);
                }
            });
        }
        return deferred.promise;
    };

    self.checkRateLimitByKey = function (key, interval, maxRequests) {
        return self.checkRateLimitsByKey(key, [{interval: interval, maxRequests: maxRequests}]);
    };

    self.checkRateLimitsByKey = function (key, rateLimits) {
        var rateLimitsArray = [];
        for (var index in rateLimits) {
            var rateKey = index + key;
            var interval = rateLimits[index]["interval"];
            var maxRequests = rateLimits[index]["maxRequests"];
            rateLimitsArray.push(_rateLimit(rateKey, interval, maxRequests));
        }

        // Check rate limits
        return Q.allSettled(rateLimitsArray).then(function (limiter) {
            var remaining = -1;
            var rateLimit = {};
            for (var index in limiter) {
                // Check global rate limiter
                if (limiter[index]["state"] == "fulfilled") {
                    if (limiter[index]["value"]["remaining"] < 0) {
                        return Q(limiter[index]["value"]);
                    }
                    else {
                        if (limiter[index]["value"]["remaining"] <= remaining || remaining == -1) {
                            rateLimit = limiter[index]["value"];
                        }
                    }
                }
                else {
                    return Q.reject();
                }
            }
            return Q(rateLimit);
        });
    };

    return self;
};

module.exports = new thisModule();