var ModuleLoader = require('mia-js-core/lib/moduleLoader');
var Utils = require('mia-js-core/lib/utils');
var _ = require('lodash');
var Memcached = require('memcached');
var Agent = require('agentkeepalive');
var HttpsAgent = require('agentkeepalive').HttpsAgent;
var MemberHelpers = Utils.MemberHelpers;
var fs = require('fs');
var Os = require('os');
var Logger;

function thisModule() {
    var self = this;

    var _shared = {};

    //<editor-fold desc="=== Server id===">
    self.getCurrentHostId = function () {
        return Os.hostname();
    };
    //</editor-fold>

    //<editor-fold desc="=== Root path ===">
    self.initializeRootPath = function (relativePath) {
        _shared.rootPath = process.cwd();
    };

    self.rootPath = function (relativePath) {
        if (!_shared.rootPath) {
            self.initializeRootPath();
        }

        if (!relativePath) {
            return _shared.rootPath;
        }
        else {
            return _shared.rootPath + relativePath;
        }
    };

    self.projectPath = function (relativePath) {
        if (!_shared.rootPath) {
            self.initializeRootPath();
        }

        if (!relativePath) {
            return _shared.rootPath + '/' + self.config("system.path.projects");
        }
        else {
            return _shared.rootPath + '/' + self.config("system.path.projects") + relativePath;
        }

    };
    //</editor-fold>

    //<editor-fold desc="=== Set app ===">
    self.setApp = function (app) {
        _shared.app = app;
    };

    self.app = function (method) {
        if (!method) {
            return _shared.app;
        }
        else {
            return _shared.app[method];
        }
    };

    self.setExpress = function (express) {
        _shared.express = express;
    };

    self.express = function () {
        return _shared.express;
    };
    //</editor-fold>

    //<editor-fold desc="=== Config ===">
    self.initializeConfig = function (configPath, mode) {
        configPath = configPath || '/config';
        mode = mode || 'local';

        //load config
        _shared.config = ModuleLoader.optional({
            dirName: self.rootPath() + '/' + configPath,
            fileNameFilter: /(.+)\.(js)$/,
            mode: 'tree'
        });

        var apiConfig = ModuleLoader.optional({
            dirName: self.rootPath() + '/' + self.config("system.path.projects"),
            moduleDir: self.config("system.path.modules.config"),
            fileNameFilter: /(.+)\.(js)$/,
            mode: 'list'
        });

        //merge api config with system config
        _.assign(_shared.config, apiConfig);

        //extract and add current environment to config

        var env = _shared.config.env && _shared.config.env[mode] ? _shared.config.env[mode] : undefined;
        _shared.config.environment = env || _shared.config.system[mode] || {};
        _shared.config.environment.mode = mode;
    };

    self.config = function (path) {
        if (!_shared.config) {
            self.initializeConfig();
        }

        if (!path) {
            return _shared.config;
        }
        else {
            var pathPropertyValue = MemberHelpers.getPathPropertyValue(_shared.config, path);
            if (_.isUndefined(pathPropertyValue)) {
                Logger.warn("Config parameter '" + path + "' is undefined");
            }
            return pathPropertyValue;
        }
    };
    //</editor-fold>

    //<editor-fold desc="=== Routes ===">
    self.initializeRoutesConfig = function () {

        //load config
        _shared.routesConfig = ModuleLoader.optional({
            dirName: self.rootPath() + '/' + self.config("system.path.projects"),
            moduleDir: self.config("system.path.modules.routes"),
            fileNameFilter: /(.+)\.(js)$/,
            mode: 'list'
        });
    };

    self.routesConfig = function () {
        if (!_shared.routesConfig) {
            self.initializeRoutesConfig();
        }

        return _shared.routesConfig;
    };
    //</editor-fold>

    //<editor-fold desc="=== Libs ===">
    self.initializeLibs = function () {

        //load config
        _shared.libs = ModuleLoader.optional({
            dirName: self.rootPath() + '/' + self.config("system.path.projects"),
            moduleDir: self.config("system.path.modules.libs"),
            fileNameFilter: /(.+)\.(js)$/,
            mode: 'list',
            useVersions: true
        });
    };

    self.libs = function (path) {
        if (!_shared.libs) {
            self.initializeLibs();
        }

        if (!path) {
            return _shared.libs;
        }
        else {
            if (!_.isArray(path)) {
                path = [path, "1.0"];
            }
            var pathPropertyValue = MemberHelpers.getPathPropertyValue(_shared.libs, path);
            if (_.isUndefined(pathPropertyValue)) {
                Logger.warn("Lib '" + path + "' is undefined");
            }
            return pathPropertyValue;
        }
    };
    //</editor-fold>

    //<editor-fold desc="=== Models ===">
    self.initializeModels = function () {
        _shared.models = ModuleLoader.optional({
            dirName: self.rootPath() + '/' + self.config("system.path.projects"),
            moduleDir: self.config("system.path.modules.models"),
            fileNameFilter: /(.+)\.(js)$/,
            mode: 'list'
        });
    };

    self.models = function (name) {
        if (!_shared.models) {
            self.initializeModels();
        }

        if (!name) {
            return _shared.models;
        }
        else {
            var model = _shared.models[name];
            if (_.isUndefined(model)) {
                Logger.warn("Model '" + name + "' is undefined");
            }
            return model;
        }
    };

    self.newModelInstance = function (name) {
        var model = self.models(name);
        return new model();
    };
    //</editor-fold>

    //<editor-fold desc="=== Controllers ===">
    self.initializeControllers = function () {
        _shared.controllers = ModuleLoader.optional({
            dirName: self.rootPath() + '/' + self.config("system.path.projects"),
            moduleDir: self.config("system.path.modules.controllers"),
            fileNameFilter: /(.+)\.(js)$/,
            mode: 'list',
            useVersions: true
        });
    };

    //<editor-fold desc="=== Controllers ===">
    /* self.initializeInit = function () {
     _shared.init = ModuleLoader.optional({
     dirName: self.rootPath() + '/' + self.config("system.path.projects"),
     moduleDir: self.config("system.path.modules.init"),
     fileNameFilter: /(.+)\.(js)$/,
     mode: 'list',
     useVersions: true
     });
     };*/

    self.initializeInit = function (initPath, mode) {
        initPath = initPath || '/init';
        mode = mode || 'local';

        //load init
        _shared.init = ModuleLoader.optional({
            dirName: self.rootPath() + '/' + initPath,
            fileNameFilter: /(.+)\.(js)$/,
            mode: 'list'
        });

        var projectInit = ModuleLoader.optional({
            dirName: self.rootPath() + '/' + self.config("system.path.projects"),
            moduleDir: self.config("system.path.modules.init"),
            fileNameFilter: /(.+)\.(js)$/,
            mode: 'list'
        });

        //merge api init with system init
        _.assign(_shared.init, projectInit);
    };

    self.init = function (name) {
        if (!_shared.models) {
            self.initializeInit();
        }

        if (!name) {
            return _shared.init;
        }
        else {
            var init = _shared.init[name];
            if (_.isUndefined(init)) {
                Logger.warn("Init '" + name + "' is undefined");
            }
            return init;
        }
    };


    self.controllers = function (path) {
        if (!_shared.controllers) {
            self.initializeControllers();
        }

        if (!path) {
            return _shared.controllers;
        }
        else {
            if (!_.isArray(path)) {
                path = [path, "1.0"];
            }

            var controller = MemberHelpers.getPathPropertyValue(_shared.controllers, path);
            if (_.isUndefined(controller)) {
                Logger.warn("Controller '" + path + "' is undefined");
            }

            return controller;
        }
    };
    //</editor-fold>

    //<editor-fold desc="=== Initialize ===">
    self.initialize = function (configPath, mode) {
        self.initializeConfig(configPath, mode);
        Logger = require('mia-js-core/lib/logger');
        self.initializeDependencies();
    };

    self.initializeDependencies = function () {
        Logger.info('Initializing inits...');
        self.initializeInit();
        Logger.info('Initializing routes...');
        self.initializeRoutesConfig();
        Logger.info('Initializing models...');
        self.initializeModels();
        Logger.info('Initializing libs...');
        self.initializeLibs();
        Logger.info('Initializing controllers...');
        self.initializeControllers();
        Logger.info('Initializing crons...');
        self.initializeCronModules();
    };
    //</editor-fold>

    //<editor-fold desc="=== Register adapters ===">
    self.registerDbAdapter = function (name, adapter) {
        _shared.adapters = _shared.adapters || {};
        _shared.adapters[name] = adapter;
    };

    self.adapters = function (name) {
        _shared.adapters = _shared.adapters || {};
        if (!name) {
            return _shared.adapters;
        }
        else {
            return _shared.adapters[name];
        }
    };
    //</editor-fold>

    //<editor-fold desc="=== Register adapters ===">
    self.registerDbConnection = function (name, dbconnection) {
        _shared.dbconnection = _shared.dbconnection || {};
        _shared.dbconnection[name] = dbconnection;
    };

    self.dbconnection = function (name) {
        _shared.dbconnection = _shared.dbconnection || {};
        if (!name) {
            return _shared.dbconnection;
        }
        else {
            return _shared.dbconnection[name];
        }
    };
    //</editor-fold>

    //<editor-fold desc="=== Register services ===">
    self.registerService = function (service) {
        self.registeredServices().push(service);
    };

    self.registeredServices = function () {
        _shared.registeredServices = _shared.registeredServices || [];
        return _shared.registeredServices;
    };
    //</editor-fold>

    //<editor-fold desc="=== Crons ===">
    self.initializeCronModules = function () {
        _shared.cronModules = ModuleLoader.optional({
            dirName: self.rootPath() + '/' + self.config("system.path.projects"),
            moduleDir: self.config("system.path.modules.crons"),
            fileNameFilter: /(.+)\.(js)$/,
            mode: 'list'
        });
    };

    self.cronModules = function (path) {
        if (!_shared.cronModules) {
            self.initializeCronModules();
        }

        if (!path) {
            return _shared.cronModules;
        }
        else {
            var cron = MemberHelpers.getPathPropertyValue(_shared.cronModules, path);
            if (_.isUndefined(cron)) {
                Logger.warn("Cron '" + path + "' is undefined");
            }
            return cron
        }
    };
    //</editor-fold>

    //<editor-fold desc="=== Memcached ===">
    var _memcached;
    self.memcached = function () {
        if (!_memcached) {
            var env = self.config('environment');
            var memcachedSettings = env.memcached || null;

            if (memcachedSettings != null) {
                if (_.isEmpty(memcachedSettings.servers)) {
                    throw new Error("Memcached config settings \'servers\' missing");
                }
                if (_.isEmpty(memcachedSettings.options)) {
                    throw new Error("Memcached config settings \'options\' missing");
                }
                _memcached = new Memcached(memcachedSettings.servers, memcachedSettings.options);

                if (memcachedSettings.flushOnStart === true) {
                    _memcached.flush(function (err, done) {
                        if (!err) {
                            Logger.info('Flushed memcache');
                        }
                    });
                }
            }
        }
        return _memcached;
    };
    //</editor-fold>

    self.setDbAvailableConnections = function (dbConnections) {
        _shared.availableDbConnections = dbConnections;
    };

    self.isDbConnectionAvailable = function () {
        return !_.isEmpty(_shared.availableDbConnections);
    };

    var _httpKeepaliveAgent;
    var _httpsKeepaliveAgent;
    self.keepAliveAgent = function (protocol) {
        var defaultKeepAliveAgentOptions = {
            maxSockets: 1024,
            maxFreeSockets: 10,
            timeout: 60000,
            keepAliveTimeout: 30000 // free socket keepalive for 30 seconds
        };
        var env = self.config('environment');

        if (protocol == "https") {
            if (!_httpKeepaliveAgent) {
                _httpsKeepaliveAgent = new HttpsAgent(env.keepAliveAgentOptions || defaultKeepAliveAgentOptions);
            }
            return _httpKeepaliveAgent
        }
        else{
            if (!_httpKeepaliveAgent) {
                _httpKeepaliveAgent = new Agent(env.keepAliveAgentOptions || defaultKeepAliveAgentOptions);
            }
            return _httpKeepaliveAgent
        }
    };

    return self;
};

module.exports = new thisModule();