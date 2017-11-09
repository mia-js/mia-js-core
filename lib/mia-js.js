var Shared = require('./shared'); //MiaJs.Shared;

var Q = require('q')
    , express = require('express')
    , vhost = require('vhost')
    , bodyParser = require('body-parser')
    , morgan = require('morgan')
    , Trycatch = require('trycatch')
    , http = require('http')
    , https = require('https')
    , appHttp = express()
    , appHttps = express()
    , path = require('path')
    , Async = require('async')
    , Logger = require('./logger')
    , MongoAdapter = require('./dbAdapters').MongoAdapter
    , CronJobManagerJob = require('./cronJobs').CronJobManagerJob
    , compression = require('compression')
    , toobusy = require('toobusy-js')
    , RoutesHandler = require('./routesHandler')
    , WebpackCompiler = require('./webpackCompiler');

/**
 * Server initialization function
 */

Q.stopUnhandledRejectionTracking();

function MiaJs() {

    var self = this;
    var _initialized = false;
    var _vhosts = {};

    /**
     * Get the current host name
     * @returns {*}
     * @private
     */
    var _getHost = function () {
        Logger.info('Host: ' + Shared.getCurrentHostId());
        //loads config, models and controllers
        return Q();
    };

    /**
     * Set initialize functions
     * @returns {*}
     * @private
     */
    var _initApplication = function () {
        Shared.initialize('/config', process.argv[2]);
        Shared.setAppHttp(appHttp);
        Shared.setAppHttps(appHttps);
        Shared.setExpress(express);

        // Init memcached
        var memcached = Shared.memcached();

        //Enable gzip compression
        appHttp.use(compression());
        appHttp.disable('x-powered-by');
        appHttps.use(compression());
        appHttps.disable('x-powered-by');

        var env = Shared.config("environment");
        var maxLag = env.maxLag;
        if (maxLag) {
            toobusy.maxLag(maxLag);
        }

        appHttp.use(function (req, res, next) {
            if (maxLag && toobusy()) {
                Logger.error("Server is busy, rejected request");
                res.send(503, "I'm busy right now, sorry.");
            } else {
                next();
            }
        });

        appHttps.use(function (req, res, next) {
            if (maxLag && toobusy()) {
                Logger.error("Server is busy, rejected request");
                res.send(503, "I'm busy right now, sorry.");
            } else {
                next();
            }
        });

        return Q();
    };

    /**
     * A custom init function defined and applied on server startup
     * @private
     */
    var _customInitFuncton = function () {
    };

    /**
     * Call and set custom init function to global
     * @param initFunction
     * @returns {*}
     * @private
     */
    var _initFunctions = function (initFunction) {
        if (_.isFunction(initFunction)) {
            Logger.info("Run init function");
            _customInitFuncton = initFunction;
            initFunction(appHttp);
            initFunction(appHttps);
            return Q();
        }
        else {
            return Q();
        }
    };

    /**
     * Run scripts in init folder of projects
     * @returns {*}
     * @private
     */
    var _initDataFunctions = function () {
        var projectInitFunction = Shared.init();
        for (var index in projectInitFunction) {
            if (projectInitFunction[index]) {
                if (projectInitFunction[index]["init"] && _.isFunction(projectInitFunction[index]["init"])) {
                    projectInitFunction[index]["init"]();
                }
            }
        }
        return Q();
    };

    /**
     * Register database adapter
     * @returns {*}
     * @private
     */
    var _registerDbAdapter = function () {
        //create new mongo db Adapter
        var mongoDbAdapter = new MongoAdapter();
        //register adapter
        Shared.registerDbAdapter('mongoDbAdapter', mongoDbAdapter);
        return Q();
    };

    var _connectToDatabases = function () {

        var environment = Shared.config("environment");
        var databases = environment.mongoDatabases;

        if (!databases) {
            Logger.warn("Not connected to database. No database configuration found in environment config. All features that require a database connection are disabled.");
        }

        var dbConnectionArray = [];
        for (var db in databases) {
            dbConnectionArray.push(Shared.adapters("mongoDbAdapter").connect(db));
        }
        Shared.setDbAvailableConnections(dbConnectionArray);
        return Q.all(dbConnectionArray);
    };

    /**
     * Set morgan logger
     * @returns {*}
     * @private
     */
    var _setLogger = function () {
        //set logger
        if (!module.parent) {
            appHttp.use(morgan({format: 'dev'}));
            appHttps.use(morgan({format: 'dev'}));
        }
        return Q();
    };

    /**
     * Parse virtual host definition from mia.js global environment configuration
     * @param host
     * @private
     */
    var _parseHosts = function (host) {
        if (_.isEmpty(host.id) || !_.isString(host.id)) {
            throw new Error("Host configuration is invalid. Host id is missing or not a string");
        }
        if (_.isEmpty(host.host)) {
            throw new Error("Host configuration is invalid. Host is missing");
        }

        if (_.isString(host.host)) {
            host.host = [host.host];
        }

        if (!_.isArray(host.host)) {
            throw new Error("Host configuration is invalid. Host should be array or string");
        }

        var expressInstance = express();

        // Check if host is already defined. Use same express instance to merge routes
        for (var index in _vhosts) {
            for (var vh in _vhosts[index]["host"]) {
                if (_vhosts[index]["host"][vh] == host.host) {
                    expressInstance = _vhosts[index]["express"];
                }
            }
        }

        _vhosts[host.id] = {
            host: host.host,
            express: expressInstance,
            http: !host.listener ? true : host.listener && host.listener.http || null,
            https: !host.listener ? true : host.listener && host.listener.https || null
        };

        _applyExpressConfig(_vhosts[host.id]["express"]);
        _customInitFuncton(_vhosts[host.id]["express"]);
    };

    /**
     * Apply custom express configuration to virtual hosts express instance
     * @param app
     * @private
     */
    var _applyExpressConfig = function (app) {
        app.use(compression());
        app.disable('x-powered-by');
    };

    /**
     * Register all routes defined in routes definition of projects and apply to virtual hosts
     * @returns {*}
     * @private
     */
    var _initRoutes = function () {
        //load routes
        var environment = Shared.config("environment");
        var hosts = environment.hosts;
        if (hosts) {
            if (!_.isArray(hosts)) {
                hosts = [hosts];
            }
            for (var host in hosts) {
                _parseHosts(hosts[host]);
            }
        }
        _vhosts["*"] = {
            host: '*',
            express: express()
        };

        _applyExpressConfig(_vhosts["*"]["express"]);
        _customInitFuncton(_vhosts["*"]["express"]);

        _vhosts = RoutesHandler.initializeRoutes(_vhosts);
        return Q();
    };

    /**
     * Start cron manager
     * @returns {*}
     * @private
     */
    var _cronJobStarter = function () {
        var nameOfCronjobToStart = _getNameOfCronjobToStart();
        if (!nameOfCronjobToStart && Shared.config("environment.cronJobs.enabled") === true && Shared.isDbConnectionAvailable() === true) {
            return CronJobManagerJob.startListening().then(function () {
                Logger.tag('Cron').info('Cron Job Manager is started.');
                return Q();
            }, function (err) {
                Logger.tag('Cron').error('Error starting Cron Job Manager ');
                return Q.reject(err);
            });
        }
        else if (nameOfCronjobToStart) {
            Logger.tag('Cron').info('Starting single cronjob "' + nameOfCronjobToStart + '"');
            cron = Shared.cronModules(nameOfCronjobToStart);
            if (!cron) {
                process.exit(1);
            }
            try {
                cron.worker(cron, cron)
                    .then(function () {
                        process.exit();
                    })
                    .catch(function () {
                        process.exit(1);
                    });
            } catch (err) {
                process.exit(1);
            }
        }
        else {
            Logger.tag('Cron').warn('Cron Manager is disabled for this environment.');
            return Q();
        }
    };

    /**
     * Checks process arguments wether single cronjob should be started. That's the case if there is a third argument
     * in the form of "cron=NameOfCronjobToStart". NameOfCronjobToStart is returned
     * @returns {String} Name of cronjob to start
     * @private
     */
    var _getNameOfCronjobToStart = function () {
        if (process.argv[3] && process.argv[3].indexOf('cron=') !== -1) {
            return process.argv[3].split('=')[1];
        }
        return '';
    }

    /**
     * Init server
     * @param initFunction
     * @returns {*}
     */
    self.init = function (initFunction) {
        return _getHost()
            .then(function () {
                return _initApplication();
            })
            .then(function () {
                return _registerDbAdapter();
            })
            .then(function () {
                return _connectToDatabases();
            })
            .then(function () {
                return _initFunctions(initFunction);
            })
            .then(function () {
                return _setLogger();
            })
            .then(function () {
                if (_getNameOfCronjobToStart()) {
                    // Skip initialization of routes if only single cronjob should be started
                    return Q();
                }
                return _initRoutes();
            })
            .then(function () {
                return _initDataFunctions();
            })
            .then(function () {
                return _cronJobStarter();
            })
            .then(function () {
                WebpackCompilerInstance = new WebpackCompiler(Logger, Shared);
                return WebpackCompilerInstance.compile();
            })
            .then(function () {
                _initialized = true;
                return Q();
            })
            .fail(function (err) {
                Logger.error(err.message || err, err.stack);
                return Q.reject(err);
            });
    };

    /**
     * Start server
     * @returns {*}
     */
    self.start = function () {
        if (_initialized == false) {
            Logger.error("MiaJs has not been initialized. Call init() before startServer()");
            return Q.reject();
        }

        if (_getNameOfCronjobToStart()) {
            // Do not start webserver when cron only mode
            Logger.info("Skipped webserver start in cron only mode");
            return Q();
        }

        //Create the virtual hosts
        for (var thisVhost in _vhosts) {
            var host = _vhosts[thisVhost];
            if (host.host != "*") {
                for (var index in host.host) {
                    if (host.http == true) {
                        Logger.info('Register http host listener for ' + host.host[index]);
                        appHttp.use(vhost(host.host[index], _vhosts[thisVhost]["express"]));
                    }
                    if (host.https == true) {
                        Logger.info('Register https host listener for ' + host.host[index]);
                        appHttps.use(vhost(host.host[index], _vhosts[thisVhost]["express"]));
                    }
                }
            }
            else {
                appHttp.all('*', _vhosts[thisVhost]["express"]);
                appHttps.all('*', _vhosts[thisVhost]["express"]);
            }
        }

        var environment = Shared.config("environment");
        var httpServer = environment && environment.server && environment.server.http ? environment.server.http : false;
        var httpsServer = environment && environment.server && environment.server.https ? environment.server.https : false;

        Trycatch(function () {
                if (httpsServer) {
                    var options = httpsServer.options;

                    if (options && options.key && options.cert && httpsServer.port) {
                        https.createServer(options, appHttps).listen(httpsServer.port);
                        Logger.info('Server is in "' + Shared.config("environment.mode") + '" mode and is listening on port ' + httpsServer.port + ' using SSL encryption');
                    }
                    else {
                        Logger.error('Missing or invalid ssl options. Please define key,cert and port');
                    }
                }

                // Forward http traffic to https
                if (httpServer && httpServer.port) {
                    if (httpServer.redir === true) {
                        http.createServer(function (req, res) {
                            //Strip out port number
                            var hostname = ( req.headers.host.match(/:/g) ) ? req.headers.host.slice(0, req.headers.host.indexOf(":")) : req.headers.host;
                            var port = httpsServer.port != 443 ? ":" + httpsServer.port : "";
                            res.writeHead(301, {"Location": "https://" + hostname + port + req.url});
                            res.end();
                        }).listen(httpServer.port);
                        Logger.info('Force using SSL - redirect all incoming traffic on port ' + httpServer.port + ' to ' + httpsServer.port + '.');
                    }
                    else {
                        appHttp.listen(httpServer.port);
                        Logger.info('Server is in "' + Shared.config("environment.mode") + '" mode and is listening on port ' + httpServer.port + '.');
                    }
                }

                if (!httpServer && !httpsServer) {
                    Logger.error('Server port is not defined. Apply default server settings');
                    appHttp.listen(3000);
                    Logger.info('Server is in "' + Shared.config("environment.mode") + '" mode and is listening on port ' + httpServer.port + '.');
                }
            },
            function (err) {
                Logger.error(null, err);
            }
        );
        return Q();
    };

    return self;
}

module.exports = new MiaJs();