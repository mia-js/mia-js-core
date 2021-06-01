var Shared = require('./shared'); //MiaJs.Shared;

require("node-jsx").install({extension: ".jsx"});

var Q = require('q')
    , express = require('express')
    , vhost = require('vhost')
    , bodyParser = require('body-parser')
    , morgan = require('morgan')
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
    , WebpackCompiler = require('./webpackCompiler')
    , _ = require('lodash')
    , MiaError = require('./errorHandler/lib/error');

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
        return Q();
    };

    /**
     * Set initialize functions
     * @returns {*}
     * @private
     */
    var _initApplication = async function () {
        Shared.initialize('/config', process.argv[2]);
        Shared.setAppHttp(appHttp);
        Shared.setAppHttps(appHttps);
        Shared.setExpress(express);

        // Init memcached
        var memcached = Shared.memcached();

        // Init redis cache
        var redis = await Shared.redis(true);

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
                res.status(503).send("I'm busy right now, sorry.");
            } else {
                next();
            }
        });

        appHttps.use(function (req, res, next) {
            if (maxLag && toobusy()) {
                Logger.error("Server is busy, rejected request");
                res.status(503).send("I'm busy right now, sorry.");
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
            return initFunction(appHttp)
                .then(function () {
                    return initFunction(appHttps);
                });
        }
        return Q();
    };

    /**
     * Run scripts in init folder of projects
     * @returns {*}
     * @private
     */
    const _initDataFunctions = async () => {
        const projectInitModules = Shared.init();
        for (const key in projectInitModules) {
            if (!projectInitModules.hasOwnProperty(key)) continue;
            const initModule = projectInitModules[key];
            if (initModule["init"] && _.isFunction(initModule["init"])) {
                await initModule["init"]();
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
     * @param {Object} host
     * @param {Boolean} reInit
     * @private
     */
    var _parseHosts = function (host, reInit) {
        if (_.isEmpty(host.id) || !_.isString(host.id)) {
            throw new MiaError("Host configuration is invalid. Host id is missing or not a string");
        }
        if (_.isEmpty(host.host)) {
            throw new MiaError("Host configuration is invalid. Host is missing");
        }

        if (_.isString(host.host)) {
            host.host = [host.host];
        }

        if (!_.isArray(host.host)) {
            throw new MiaError("Host configuration is invalid. Host should be array or string");
        }

        var router = new express.Router();

        if (reInit === false) {
            // Check if host is already defined. Use same router instance to merge routes
            for (var index in _vhosts) {
                for (var vh in _vhosts[index]["host"]) {
                    if (_vhosts[index]["host"][vh] == host.host) {
                        router = _vhosts[index]["router"];
                    }
                }
            }
        }

        _vhosts[host.id] = {
            host: host.host,
            router: router,
            http: !host.listener ? true : host.listener && host.listener.http || null,
            https: !host.listener ? true : host.listener && host.listener.https || null
        };

        _applyRouterConfig(_vhosts[host.id]["router"]);
        _customInitFuncton(_vhosts[host.id]["router"]);
    };

    /**
     * Apply custom express configuration to virtual hosts router instance
     * @param app
     * @private
     */
    var _applyRouterConfig = function (app) {
        //app.use(compression());
        //app.disable('x-powered-by');
    };

    /**
     * Register all routes defined in routes definition of projects and apply to virtual hosts
     * @param {Boolean} reInit
     * @returns {*}
     * @private
     */
    var _initRoutes = function (reInit = false) {
        //load routes
        var environment = Shared.config("environment");
        var hosts = environment.hosts;
        if (hosts) {
            if (!_.isArray(hosts)) {
                hosts = [hosts];
            }
            for (var host in hosts) {
                _parseHosts(hosts[host], reInit);
            }
        }
        _vhosts["*"] = {
            host: '*',
            router: new express.Router()
        };

        _applyRouterConfig(_vhosts["*"]["router"]);
        _customInitFuncton(_vhosts["*"]["router"]);

        /**
         * Ensure that there are no services registered before we initialize routes
         */
        Shared.unregisterServices();
        return RoutesHandler.initializeRoutes(_vhosts, reInit === false);
    };

    /**
     * @see https://github.com/expressjs/express/issues/2596#issuecomment-81353034
     * @returns {*}
     */
    self.reInitRoutes = function () {
        Logger.info('Reinitializing express routes...');
        Shared.unregisterServices();
        return _initRoutes(true)
            .then(() => Logger.info('All routes successfully reinitialized'));
    };

    /**
     * Start cron manager
     * @returns {*}
     * @private
     */
    const _cronJobStarter = function () {
        const cronJobsToStart = Shared.getRuntimeArgumentsValues('cron');
        if (_.isEmpty(cronJobsToStart) && _shouldStartCrons() && Shared.isDbConnectionAvailable() === true) {
            return CronJobManagerJob.startListening().then(function () {
                Logger.tag('Cron').info('Cron Job Manager is started. Starting all available cron jobs');
                return Q();
            }, function (err) {
                Logger.tag('Cron').error('Error starting Cron Job Manager ');
                return Q.reject(new MiaError(err));
            });
        } else if (!_.isEmpty(cronJobsToStart) && _shouldStartCrons()) {

            Logger.tag('Cron').info('Starting specific cron jobs "' + cronJobsToStart.join(', ') + '"');

            try {
                const cronJobs = Shared.cronModules(cronJobsToStart);
                let promises = [];
                for (let cron of cronJobs) {
                    // Set force run config
                    cron.forceRun = true;
                    promises.push(cron.worker(cron, cron));
                }
                return Q.all(promises)
                    .then(() => process.exit())
                    .catch((err) => {
                        Logger.tag('Cron').error(err);
                        process.exit(1);
                    });
            } catch (err) {
                Logger.tag('Cron').error(err);
                process.exit(1);
            }
        } else {
            Logger.tag('Cron').warn('Cron Manager is disabled for this environment.');
            return Q();
        }
    };

    /**
     * Apply server options given in env config to server
     * @param type
     * @param server
     * @param options
     * @private
     */
    const _applyServerOptions = (type, server, options) => {
        const blacklist = ['key', 'cert', 'ca', 'passphrase'];
        if (options && typeof options === 'object' && (options).constructor === Object && !_.isEmpty(options)) {
            Logger.debug('[' + type + ' Server Settings]------------------------------------');
            for (const key in options) {
                if (!options.hasOwnProperty(key) || blacklist.indexOf(key) !== -1) continue;
                Logger.debug(key + ':' + JSON.stringify(options[key]));
                server[key] = options[key];
            }
            Logger.debug('----------------------------------------------------------')
        }
    };

    /**
     * @return {boolean}
     * @private
     */
    const _shouldStartCrons = () => {
        if (Shared.runtimeArgs.nocron) {
            return false;
        }
        return Shared.config("environment.cronJobs.enabled") === true;
    };

    /**
     * Init server
     * @param initFunction
     * @returns {*}
     */
    self.init = function (initFunction) {
        _parseArgs();

        var WebpackCompilerInstance = new WebpackCompiler(Logger, Shared);

        return _getHost()
            .then(function () {
                return _initApplication();
            })
            .then(function () {
                // Compile individual projects
                return WebpackCompilerInstance.compile()
                    .then(function () {
                        if (Shared.runtimeArgs.build) {
                            // Exit if we're in the build process
                            process.exit(0);
                        }
                        return Q();
                    });
            })
            .then(function () {
                return _registerDbAdapter();
            })
            .then(function () {
                return _connectToDatabases();
            })
            .then(function () {
                return _setLogger();
            })
            .then(function () {
                return _initFunctions(initFunction);
            })
            .then(function () {
                return _initDataFunctions();
            })
            .then(function () {
                if (!_.isEmpty(Shared.getRuntimeArgumentsValues('cron')) && _shouldStartCrons()) {
                    // Skip initialization of routes if specific cron jobs should be started
                    return Q();
                }
                return _initRoutes();
            })
            .then(function () {
                return _cronJobStarter();
            })
            .then(function () {
                // Compile development server in parallel and don't wait for promise to be resolved
                return WebpackCompilerInstance.compileServer();
            })
            .then(function () {
                _initialized = true;
                return Q();
            })
            .catch(function (err) {
                Logger.error(err.message || err, err.stack);
                return Q.reject(new MiaError(err));
            });
    };

    const _parseArgs = () => {
        const args = process.argv || [];
        const parsedArgs = {};
        args.forEach(arg => {
            if (arg.indexOf("=") >= 0) {
                const [key, value] = arg.split("=").slice(0, 2);
                parsedArgs[key] = value;
            } else {
                parsedArgs[arg] = true;
            }
        });
        Shared.runtimeArgs = parsedArgs;
    };

    /**
     * Start server
     * @returns {*}
     */
    self.start = async function () {

        if (_initialized == false) {
            Logger.error("MiaJs has not been initialized. Call init() before startServer()");
            return Q.reject();
        }

        if (!_.isEmpty(Shared.getRuntimeArgumentsValues('cron')) && _shouldStartCrons()) {
            // Do not start webserver when cron only mode
            Logger.info("Skipped webserver start in cron only mode");
            return Q();
        }

        //Create the virtual hosts
        for (var thisVhost in _vhosts) {
            var host = _vhosts[thisVhost];
            var routing = function (vhost) {
                return function (req, res, next) {
                    _vhosts[vhost]["router"](req, res, next);
                }
            };

            if (host.host != "*") {
                for (var index in host.host) {
                    if (host.http == true) {
                        Logger.info('Register http host listener for ' + host.host[index]);
                        appHttp.use(vhost(host.host[index], routing(thisVhost)));
                    }
                    if (host.https == true) {
                        Logger.info('Register https host listener for ' + host.host[index]);
                        appHttps.use(vhost(host.host[index], routing(thisVhost)));
                    }
                }
            } else {
                appHttp.use(routing(thisVhost));
                appHttps.use(routing(thisVhost));
            }
        }

        var environment = Shared.config("environment");
        var httpServerConfig = environment && environment.server && environment.server.http ? environment.server.http : false;
        var httpsServerConfig = environment && environment.server && environment.server.https ? environment.server.https : false;

        let serverObjectHttp;
        let serverObjectHttps;

        try {
            if (httpsServerConfig) {
                var options = httpsServerConfig.options;

                if (options && options.key && options.cert && httpsServerConfig.port) {
                    const httpsServer = https.createServer(options, appHttps);
                    serverObjectHttps = await httpsServer.listen(httpsServerConfig.port);
                    _applyServerOptions('HTTPS', serverObjectHttps, httpsServerConfig.options);
                    Logger.info('Server is in "' + Shared.config("environment.mode") + '" mode and is listening on port ' + httpsServerConfig.port + ' using SSL encryption');
                } else {
                    Logger.error('Missing or invalid ssl options. Please define key,cert and port');
                }
            }

            // Forward http traffic to https
            if (httpServerConfig && httpServerConfig.port) {
                if (httpServerConfig.redir === true) {
                    let port = httpServerConfig.redirPort ? httpServerConfig.redirPort : httpsServerConfig.port;
                    const httpServer = http.createServer(function (req, res) {
                        let hostname = httpServerConfig.redirFallbackHostname;
                        if (req.headers.host) {
                            // Strip out port number
                            hostname = httpServerConfig.redirHostname ? httpServerConfig.redirHostname : ((req.headers.host.match(/:/g)) ? req.headers.host.slice(0, req.headers.host.indexOf(":")) : req.headers.host);
                        } else {
                            Logger.info('Could not determine hostname from request, fallback to configured redirect hostname', req.headers)
                        }
                        port = port && [80, 443].indexOf(port) === -1 ? ":" + port : "";
                        res.writeHead(301, {"Location": "https://" + hostname + port + req.url});
                        res.end();
                    });
                    serverObjectHttp = await httpServer.listen(httpServerConfig.port);
                    _applyServerOptions('HTTP', serverObjectHttp, httpServerConfig.options);
                    Logger.info('Force using SSL - redirect all incoming traffic on port ' + httpServerConfig.port + ' to ' + port + '.');
                } else {
                    serverObjectHttp = await appHttp.listen(httpServerConfig.port);
                    _applyServerOptions('HTTP', serverObjectHttp, httpServerConfig.options);
                    Logger.info('Server is in "' + Shared.config("environment.mode") + '" mode and is listening on port ' + httpServerConfig.port + '.');
                }
            }

            if (!httpServerConfig && !httpsServerConfig) {
                serverObjectHttp = Logger.error('Server port is not defined. Apply default server settings');
                await appHttp.listen(3000);
                Logger.info('Server is in "' + Shared.config("environment.mode") + '" mode and is listening on port ' + httpServerConfig.port + '.');
            }
        } catch (err) {
            Logger.error(null, err);
        }

        return Q({
            server: {
                http: serverObjectHttp,
                https: serverObjectHttps
            }
        })
    };

    return self;
}

module.exports = new MiaJs();
