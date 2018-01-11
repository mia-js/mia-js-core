var Shared = require('./../../shared')
    , Utils = require('./../../utils')
    , Logger = require('./../../logger')
    , Memcached = require('./memcachedCacheHandler')
    , Redis = require('./redisCacheHandler')
    , Q = require("q");

function thisModule() {
    /**
     * Select default cache handler
     * @param identifier
     * @param lifetime
     * @param renew
     * @param gracetime
     * @param func
     * @returns {*}
     */

    var cached = function (identifier, lifetime, renew, gracetime, func) {
        var env = Shared.config("environment");

        var defaultCache = "memcached";

        if (env.defaultCache) {
            defaultCache = env.defaultCache
        }
        else {
            if (env.redis && env.memcached) {
                Logger.warn("Use memcached as default cache due to 'defaultCache' not set in environment config settings");
            }
            if (env.redis && !env.memcached) {
                defaultCache = "redis"
            }
        }

        switch (defaultCache) {
            case "redis":
                return Redis(identifier, lifetime, renew, gracetime, func);
            default:
                return Memcached(identifier, lifetime, renew, gracetime, func);
        }

    };

    return cached;
}


module.exports = thisModule();
