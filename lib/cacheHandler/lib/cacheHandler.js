var Shared = require('mia-js-core/lib/shared')
    , Utils = require('mia-js-core/lib/utils')
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
    var cached = function (identifier, lifetime, renew, func) {
        var deferred = Q.defer();
        var memcached = Shared.memcached();
        memcached.get(identifier, function (err, value) {
            if (err) {
                func().then(function (result) {
                    deferred.resolve({
                        cached: false,
                        value: result
                    });
                }).fail(function (err) {
                    deferred.reject(err);
                }).done();
            }
            else if (_.isUndefined(value)) {
                func().then(function (result) {
                    var cacheValue = {value: result, created: Date.now(), currentlyRefreshing: false};
                    memcached.set(identifier, cacheValue, lifetime, function (err) {
                    });
                    deferred.resolve({
                        cached: false,
                        value: cacheValue.value
                    });
                }).fail(function (err) {
                    deferred.reject(err);
                }).done();
            }
            else {
                //Prefill cache before it expires with renew in seconds
                if (value.currentlyRefreshing == false && value.created && ((Date.now() - value.created) / 1000) > lifetime - renew) {
                    memcached.replace(identifier, {
                        value: value.value,
                        created: value.created,
                        currentlyRefreshing: true
                    }, lifetime, function (err) {
                    });
                    // Update Cache async before it expires
                    func().then(function (result) {
                        var cacheValue = {value: result, created: Date.now(), currentlyRefreshing: false};
                        memcached.set(identifier, cacheValue, lifetime, function (err) {
                        });
                    }).done();
                }
                // Cache identifier exists return value
                deferred.resolve({
                    cached: true,
                    value: value.value
                });
            }
        });
        return deferred.promise;
    };

    return cached;
}


module.exports = thisModule();
