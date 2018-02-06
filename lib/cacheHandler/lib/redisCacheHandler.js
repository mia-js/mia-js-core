var Shared = require('./../../shared/index')
    , Utils = require('./../../utils/index')
    , Logger = require('./../../logger/index')
    , Q = require("q");

function thisModule() {
    /**
     * Get a cache key from memcache and sets response of func as value of key if cache key does not exists
     * @param identifier
     * @param lifetime
     * @param renew - Time in seconds when cache should be refreshed async before lifetime is exceeded. i.e. 10 means lifetime - 10 seconds
     * @param gracetime
     * @param func
     * @returns {promise.promise|jQuery.promise|d.promise|promise|Q.promise|jQuery.ready.promise|*}
     */

    var cached = function (identifier, lifetime, renew, gracetime, func) {
        gracetime = _.isNumber(gracetime) ? gracetime : 0;
        lifetime = _.isNumber(lifetime) ? lifetime : 0;
        renew = _.isNumber(renew) ? renew : 0;

        var deferred = Q.defer();
        var redis = Shared.redis();

        if (!redis) {
            if (typeof func !== "function") {
                // GET ONLY
                func = function () {
                    return Q(null);
                }
            }
            Logger.warn("Redis cache not available. RedisCacheHandler used but 'redis' not configured in environment config settings");
            func().then(function (result) {
                deferred.resolve({
                    cached: false,
                    value: result,
                    timeleft: 0,
                    cacheTime: 0
                });
            }).fail(function (err) {
                deferred.reject(err);
            }).done();
        }
        else {
            if (typeof func !== "function") {
                // GET ONLY
                redis.get(identifier, function (err, value) {
                    if (err) {
                        if (err.code && err.code == "NR_CLOSED" || err.message.match(/not available/) != -1) {
                            Logger.warn("Redis cache not available. Return uncached value for identifier: " + identifier);
                        } else {
                            Logger.warn("Redis cache error while getting value for identifier: " + identifier, err);
                        }
                    }

                    if (value == null) {
                        deferred.resolve({
                            cached: false,
                            value: null,
                            timeleft: 0,
                            cacheTime: 0
                        });
                    }
                    else {
                        try {
                            value = JSON.parse(value);
                        }
                        catch (err) {
                            Logger.warn("Redis cache can not parse value for identifier: " + identifier);
                            deferred.reject(err);
                            return;
                        }

                        // Cache identifier exists return value
                        deferred.resolve({
                            cached: true,
                            value: value.value,
                            timeleft: Math.abs(Math.round((Date.now() - value.expires) / 1000)),
                            cacheTime: Math.abs(Math.round((Date.now() - value.shouldRefresh) / 1000))
                        });
                    }
                });
            }
            else {
                // GET AND SET
                redis.get(identifier, function (err, value) {
                    if (err) {
                        if (err) {
                            if (err.code && err.code == "NR_CLOSED" || err.message.match(/not available/) != -1) {
                                Logger.warn("Redis cache not available. Return uncached value for identifier: " + identifier);
                            } else {
                                Logger.warn("Redis cache error while getting value for identifier: " + identifier, err);
                            }
                        }
                        func().then(function (result) {
                            deferred.resolve({
                                cached: false,
                                value: result,
                                timeleft: 0,
                                cacheTime: 0
                            });
                        }).fail(function (err) {
                            deferred.reject(err);
                        }).done();
                    }
                    else if (value == null) {
                        func().then(function (result) {
                            var cacheValue = {
                                value: result,
                                created: Date.now(),
                                refreshed: Date.now(),
                                currentlyRefreshing: false,
                                gracetime: false,
                                shouldRefresh: Date.now() + (lifetime * 1000 - renew * 1000),
                                expires: Date.now() + (lifetime * 1000)
                            };
                            redis.set(identifier, JSON.stringify(cacheValue), 'EX', parseInt(lifetime));

                            deferred.resolve({
                                cached: false,
                                value: cacheValue.value,
                                timeleft: lifetime,
                                cacheTime: 0
                            });
                        }).fail(function (err) {
                            deferred.reject(err);
                        }).done();
                    }
                    else {
                        try {
                            value = JSON.parse(value);
                        }
                        catch (err) {
                            Logger.warn("Redis cache can not parse value for identifier: " + identifier);
                            deferred.reject(err);
                            return;
                        }

                        var timeLeft = Math.abs(Math.round(((value.created / 1000) + lifetime) - (Date.now() / 1000)));
                        var timeLeftToRefresh = Math.abs(Math.round(((value.created / 1000) + lifetime - renew) - (Date.now() / 1000)));

                        if (value.gracetime == true) {
                            timeLeft = Math.abs(Math.round(((value.created / 1000) + gracetime) - (Date.now() / 1000)));
                        }

                        // Set timeLeftToRefresh to livetime to extend caching till value is already refreshed
                        if (value.currentlyRefreshing == true) {
                            timeLeftToRefresh = timeLeft
                        }

                        //Prefill cache before it expires with renew in seconds
                        if (value.currentlyRefreshing == false && value.refreshed && ((Date.now() - value.refreshed) / 1000) > lifetime - renew) {

                            // Set timeLeftToRefresh to livetime to extend caching till value is already refreshed
                            timeLeftToRefresh = timeLeft

                            redis.set(identifier, JSON.stringify({
                                value: value.value,
                                created: value.created,
                                refreshed: value.refreshed,
                                currentlyRefreshing: true,
                                gracetime: value.gracetime,
                                shouldRefresh: Date.now() + (timeLeft * 1000 - renew * 1000),
                                expires: Date.now() + (timeLeft * 1000)
                            }), 'EX', parseInt(timeLeft));

                            // Update Cache async before it expires
                            func().then(function (result) {
                                var cacheValue = {
                                    value: result,
                                    created: Date.now(),
                                    refreshed: Date.now(),
                                    currentlyRefreshing: false,
                                    gracetime: false,
                                    expires: Date.now() + (lifetime * 1000),
                                    shouldRefresh: Date.now() + (lifetime * 1000 - renew * 1000)
                                };
                                redis.set(identifier, JSON.stringify(cacheValue), 'EX', parseInt(lifetime));

                            }).fail(function () {
                                // Apply grace time if func refresh fails
                                // Renew of value is still tried ever lifetime-renew but cached value held at least gracetime
                                if (gracetime > 0 && value.gracetime == false) {
                                    redis.set(identifier, JSON.stringify({
                                        value: value.value,
                                        created: Date.now(),
                                        refreshed: Date.now(),
                                        currentlyRefreshing: false,
                                        gracetime: true,
                                        expires: Date.now() + (gracetime * 1000),
                                        shouldRefresh: Date.now() + (gracetime * 1000 - renew * 1000)
                                    }), 'EX', parseInt(gracetime));
                                }
                                else {
                                    redis.set(identifier, JSON.stringify({
                                        value: value.value,
                                        created: value.created,
                                        refreshed: Date.now(),
                                        currentlyRefreshing: false,
                                        gracetime: value.gracetime,
                                        expires: Date.now() + (timeLeft * 1000),
                                        shouldRefresh: Date.now() + (timeLeft * 1000 - renew * 1000)
                                    }), 'EX', parseInt(timeLeft));
                                }
                            }).done();
                        }

                        // Cache identifier exists return value
                        deferred.resolve({
                            cached: true,
                            value: value.value,
                            timeleft: timeLeft > 0 ? timeLeft : 0,
                            cacheTime: timeLeftToRefresh
                        });
                    }
                });
            }
        }
        return deferred.promise;
    };

    return cached;
}


module.exports = thisModule();
