module.exports = {
    /*title: '7TV Middleware API (Test)',
    description: 'API documentation',
    version: '1.0',*/
    logLevel: 'warn',
    /*server: {
        http: {
            port: 4000
        }
    },
    debug: false,
    cronJobs: {
        enabled: false,
        allowedHosts: [],
        ensureIndexes: {
            autoStart: false,
            runOnStartup: false,
            useBackgroundMode: true
        }
    },
    tryCatchForRouteFunctions: false,
    memcached: {
        flushOnStart: true,
        servers: ('localhost:11211').split(','),
        options: {
            maxValue: 25000000,
            reconnect: 5000,
            retries: 0,
            retry: 500
        }
    },*/
    defaultMongoDatabase: 'miaCoreTest',
    mongoDatabases: {
        miaCoreTest: {
            url: 'mongodb://localhost:27017/miaCoreTest',
            options: {
                w: 1,
                poolSize: 15,
                keepAlive: true,
                keepAliveInitialDelay: 1,
                noDelay: true,
                connectTimeoutMS: 0,
                socketTimeoutMS: 0,
                autoReconnect: true
            }
        }
    }
};
