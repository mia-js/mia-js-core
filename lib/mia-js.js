//var MiaJs = require('./node_modules/shared');
var Shared = require('./../node_modules/shared'); //MiaJs.Shared;
//var Shared = require('mia-js-core/node_modules/shared');

require("node-jsx").install({extension: ".jsx"});

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
    , Logger = require('./../node_modules/logger')
    , MongoAdapter = require('./../node_modules/dbAdapters').MongoAdapter
    , CronJobManagerJob = require('./../node_modules/cronJobs').CronJobManagerJob
    , compression = require('compression')
    , RoutesHandler = require('./../node_modules/routesHandler');


/**
 * Server initialization function
 */

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
        Logger('info', 'Host: ' + Shared.getCurrentHostId());
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
        //Shared.setApp(app);
        Shared.setExpress(express);

        //Enable gzip compression
        appHttp.use(compression());
        appHttp.disable('x-powered-by');
        appHttps.use(compression());
        appHttps.disable('x-powered-by');

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
            Logger('info', "Run init function");
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
        Shared.registerDbAdapter('mongo', mongoDbAdapter);
        return Q();
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
        var hosts = Shared.config("environment.hosts");
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
        if (Shared.config("environment.cronJobs.enabled") === true) {
            return CronJobManagerJob.startListening().then(function () {
                Logger('info', 'Cron Job Manager is started.');
                return Q();
            }, function (err) {
                Logger('err', 'Error starting Cron Job Manager ');
                return Q.reject(err);
            });
        }
        else {
            Logger('err', 'Cron Manager is disabled for this environment.');
            return Q();
        }
    };

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
                return _initFunctions(initFunction);
            })
            .then(function () {
                return _setLogger();
            })
            .then(function () {
                return _initRoutes();
            })
            .then(function () {
                return _initDataFunctions();
            })
            .then(function () {
                return _registerDbAdapter();
            })
            .then(function () {
                return _cronJobStarter();
            })
            .then(function () {
                _initialized = true;
                return Q();
            })
            .fail(function (err) {
                console.log(err);
                return Q.reject(err);
            });
    };

    /**
     * Start server
     * @returns {*}
     */
    self.start = function () {
        if (_initialized == false) {
            Logger('err', "MiaJs has not been initialized. Call init() before startServer()");
            return Q.reject();
        }

        //Create the virtual hosts
        for (var thisVhost in _vhosts) {
            var host = _vhosts[thisVhost];
            if (host.host != "*") {
                for (var index in host.host) {
                    if (host.http == true) {
                        Logger('info', 'Register http host listener for ' + host.host[index]);
                        appHttp.use(vhost(host.host[index], _vhosts[thisVhost]["express"]));
                    }
                    if (host.https == true) {
                        Logger('info', 'Register https host listener for ' + host.host[index]);
                        appHttps.use(vhost(host.host[index], _vhosts[thisVhost]["express"]));
                    }
                }
            }
            else {
                appHttp.all('*', _vhosts[thisVhost]["express"]);
                appHttps.all('*', _vhosts[thisVhost]["express"]);
            }
        }

        var httpServer = Shared.config("environment.server.http");
        var httpsServer = Shared.config("environment.server.https");

        Trycatch(function () {
                if (httpsServer) {
                    var options = httpsServer.options;

                    if (options && options.key && options.cert && httpsServer.port) {
                        https.createServer(options, appHttps).listen(httpsServer.port);
                        Logger('info', 'Server is in "' + Shared.config("environment.mode") + '" mode and is listening on port ' + httpsServer.port + ' using SSL encryption');
                    }
                    else {
                        Logger('err', 'Missing or invalid ssl options. Please define key,cert and port');
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
                        Logger('info', 'Force using SSL - redirect all incoming traffic on port ' + httpServer.port + ' to ' + httpsServer.port + '.');
                    }
                    else {
                        appHttp.listen(httpServer.port);
                        Logger('info', 'Server is in "' + Shared.config("environment.mode") + '" mode and is listening on port ' + httpServer.port + '.');
                    }
                }

                if (!httpServer && !httpsServer) {
                    Logger('err', 'Server port is not defined.');
                }
            },
            function (err) {
                Logger('err', err);
            }
        );
        return Q();
    };

    return self;
}

module.exports = new MiaJs();