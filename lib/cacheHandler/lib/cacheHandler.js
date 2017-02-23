var Shared = require('./../../shared')
    , Utils = require('./../../utils')
    , Logger = require('./../../logger')
    , Q = require("q");

function thisModule() {
    /**
     * Get a cache key from memcache and sets response of func as value of key if cache key does not exists
     * @param identifier
     * @param lifetime
     * @param renew - Time in seconds when cache should be refreshed async before lifetime is exceeded. i.e. 10 means lifetime - 10 seconds
     * @param func
     * @returns {promise.promise|jQuery.promise|d.promise|promise|Q.promise|jQuery.ready.promise|*}
     */

    var cached = function (identifier, lifetime, renew, gracetime, func) {
        gracetime = _.isNumber(gracetime) ? gracetime : 0;
        var deferred = Q.defer();
        var memcached = Shared.memcached();
        if (!memcached) {
            Logger.warn("Cache not available. CacheHandler used but 'memcached' not configured in environment config settings");
            func().then(function (result) {
                deferred.resolve({
                    cached: false,
                    value: result,
                    timeleft: 0
                });
            }).fail(function (err) {
                deferred.reject(err);
            }).done();
        }
        else {
            memcached.get(identifier, function (err, value) {
                if (err) {
                    if (err) {
                        if (err.errno && err.errno == "ECONNREFUSED" || err.message.match(/not available/) != -1) {
                            Logger.warn("Memcached not available. Return uncached value for identifier: " + identifier);
                        } else {
                            Logger.warn("Memcached error while getting value for identifier: " + identifier, err);
                        }
                    }
                    func().then(function (result) {
                        deferred.resolve({
                            cached: false,
                            value: result,
                            timeleft: 0
                        });
                    }).fail(function (err) {
                        deferred.reject(err);
                    }).done();
                }
                else if (_.isUndefined(value)) {
                    func().then(function (result) {
                        var cacheValue = {
                            value: result,
                            created: Date.now(),
                            refreshed: Date.now(),
                            currentlyRefreshing: false,
                            gracetime: false
                        };
                        memcached.set(identifier, cacheValue, lifetime, function (err) {
                            if (err) {
                                Logger.warn("Memcached error while setting value for identifier: " + identifier, err);
                            }
                        });
                        deferred.resolve({
                            cached: false,
                            value: cacheValue.value,
                            timeleft: lifetime
                        });
                    }).fail(function (err) {
                        deferred.reject(err);
                    }).done();
                }
                else {
                    var timeLeft = Math.round(((value.created / 1000) + lifetime) - (Date.now() / 1000));

                    if (value.gracetime == true) {
                        timeLeft = Math.round(((value.created / 1000) + gracetime) - (Date.now() / 1000));
                    }

                    //Prefill cache before it expires with renew in seconds
                    if (value.currentlyRefreshing == false && value.refreshed && ((Date.now() - value.refreshed) / 1000) > lifetime - renew) {
                        memcached.set(identifier, {
                            value: value.value,
                            created: value.created,
                            refreshed: value.refreshed,
                            currentlyRefreshing: true,
                            gracetime: value.gracetime
                        }, timeLeft, function (err) {
                        });
                        // Update Cache async before it expires
                        func().then(function (result) {
                            var cacheValue = {
                                value: result,
                                created: Date.now(),
                                refreshed: Date.now(),
                                currentlyRefreshing: false,
                                gracetime: false
                            };
                            memcached.set(identifier, cacheValue, lifetime, function (err) {
                                if (err) {
                                    Logger.warn("Memcached error while setting value for identifier: " + identifier, err);
                                }
                            });
                        }).fail(function () {
                            // Apply grace time if func refresh fails
                            // Renew of value is still tried ever lifetime-renew but cached value held at least gracetime
                            if (gracetime > 0 && value.gracetime == false) {
                                memcached.set(identifier, {
                                    value: value.value,
                                    created: Date.now(),
                                    refreshed: Date.now(),
                                    currentlyRefreshing: false,
                                    gracetime: true
                                }, gracetime, function (err) {
                                    if (err) {
                                        Logger.warn("Memcached error while renew value for identifier: " + identifier, err);
                                    }
                                    else {
                                        Logger.warn("Memcached renew value for identifier: " + identifier + ". Grace time of " + gracetime + " seconds applied");
                                    }
                                });
                            }
                            else {
                                memcached.set(identifier, {
                                    value: value.value,
                                    created: value.created,
                                    refreshed: Date.now(),
                                    currentlyRefreshing: false,
                                    gracetime: value.gracetime
                                }, timeLeft, function (err) {
                                });
                            }
                        }).done();
                    }

                    // Cache identifier exists return value
                    deferred.resolve({
                        cached: true,
                        value: value.value,
                        timeleft: timeLeft > 0 ? timeLeft : 0
                    });
                }
            });
        }
        return deferred.promise;
    };

    return cached;
}


module.exports = thisModule();
