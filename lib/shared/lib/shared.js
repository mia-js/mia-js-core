const ModuleLoader = require('./../../moduleLoader')
const Utils = require('./../../utils')
const _ = require('lodash')
const Memcached = require('memcached')
const Redis = require('ioredis')
const Agent = require('agentkeepalive')
const HttpsAgent = require('agentkeepalive').HttpsAgent
const MemberHelpers = Utils.MemberHelpers
const Os = require('os')
const path = require('path')
const MiaError = require('../../errorHandler/lib/error')
let Logger

function thisModule () {
  let self = this
  let _shared = {}
  // Declared in mia-js.js during bootstrapping the server
  let runtimeArgs

  self.getCurrentHostId = function () {
    return Os.hostname()
  }

  self.initializeRootPath = function (relativePath) {
    _shared.rootPath = process.cwd()
  }

  self.rootPath = function (relativePath) {
    if (!_shared.rootPath) {
      self.initializeRootPath()
    }

    if (!relativePath) {
      return _shared.rootPath
    } else {
      return _shared.rootPath + relativePath
    }
  }

  self.projectPath = function (relativePath) {
    if (!_shared.rootPath) {
      self.initializeRootPath()
    }

    if (!relativePath) {
      return _shared.rootPath + '/' + self.config('system.path.projects')
    } else {
      return _shared.rootPath + '/' + self.config('system.path.projects') + relativePath
    }

  }

  /**
   * Set express app for http
   * @param {Object} app
   */
  self.setAppHttp = function (app) {
    _shared.appHttp = app
  }

  /**
   * Get express app for http
   * @param {String} method
   * @returns {Object}
   */
  self.appHttp = function (method) {
    if (!method) {
      return _shared.appHttp
    } else {
      return _shared.appHttp[method]
    }
  }

  /**
   * Set express app for https
   * @param {Object} app
   */
  self.setAppHttps = function (app) {
    _shared.appHttps = app
  }

  /**
   * Get express app for https
   * @param {String} method
   * @returns {Object}
   */
  self.appHttps = function (method) {
    if (!method) {
      return _shared.appHttps
    } else {
      return _shared.appHttps[method]
    }
  }

  self.setExpress = function (express) {
    _shared.express = express
  }

  self.express = function () {
    return _shared.express
  }

  self.initializeConfig = function (configPath, mode) {
    configPath = configPath || '/config'
    mode = mode || 'local'

    //load config
    _shared.config = ModuleLoader.optional({
      dirName: self.rootPath() + configPath,
      fileNameFilter: /(.+)\.(js)$/,
      mode: 'tree'
    })

    if (!_.isUndefined(_shared.config.system)) {
      var projectsConfig = ModuleLoader.optional({
        dirName: self.rootPath() + '/' + self.config('system.path.projects'),
        moduleDir: self.config('system.path.modules.config'),
        fileNameFilter: /(.+)\.(js)$/,
        mode: 'list',
        useVersions: true
      })

      //merge system config with projects config
      _.assign(_shared.config, projectsConfig)
    }

    //extract and add current environment to config

    var env = _shared.config.env && _shared.config.env[mode] ? _shared.config.env[mode] : undefined
    _shared.config.environment = env || _shared.config.system[mode] || {}
    _shared.config.environment.mode = mode
  }

  var _appendVersion = function (path) {
    path.splice(1, 0, '1.0')
    return path
  }

  self.reInitializeConfig = function () {
    self.initializeConfig('/' + _shared.config.system.path.config, _shared.config.environment.mode)
    Logger.info('[HMR] All configs successfully reinitialized')
  }

  self.config = function (path) {

    if (!_shared.config) {
      self.initializeConfig()
    }

    if (!path) {
      return _shared.config
    } else {
      var pathArray
      if (_.isArray(path)) {
        pathArray = path
      } else {
        pathArray = path.split('.')
        if (pathArray[0] != 'system' && pathArray[0] != 'environment' && pathArray[0] != 'translations') {
          pathArray = _appendVersion(pathArray)
        }
      }

      var pathPropertyValue = MemberHelpers.getPathPropertyValue(_shared.config, pathArray)
      if (_.isUndefined(pathPropertyValue)) {
        if (Logger) {
          Logger.warn('Config parameter \'' + pathArray.join('.') + '\' is undefined')
        } else {
          console.log('Config parameter \'' + pathArray.join('.') + '\' is undefined')
        }
      }
      return pathPropertyValue
    }
  }

  self.initializeRoutesConfig = function () {

    //load config
    _shared.routesConfig = ModuleLoader.optional({
      dirName: self.rootPath() + '/' + self.config('system.path.projects'),
      moduleDir: self.config('system.path.modules.routes'),
      fileNameFilter: /(.+)\.(js)$/,
      mode: 'list'
    })
  }

  self.routesConfig = function () {
    if (!_shared.routesConfig) {
      self.initializeRoutesConfig()
    }

    return _shared.routesConfig
  }

  self.setRoutesConfig = function (path, routesConfig) {
    MemberHelpers.setPathPropertyValue(_shared.routesConfig, path, routesConfig)
  }

  self.initializeLibs = function () {

    //load config
    _shared.libs = ModuleLoader.optional({
      dirName: self.rootPath() + '/' + self.config('system.path.projects'),
      moduleDir: self.config('system.path.modules.libs'),
      fileNameFilter: /(.+)\.(js)$/,
      mode: 'list',
      useVersions: true
    })
  }

  self.libs = function (path) {
    if (!_shared.libs) {
      self.initializeLibs()
    }

    if (!path) {
      return _shared.libs
    } else {
      if (!_.isArray(path)) {
        path = [path, '1.0']
      }
      var pathPropertyValue = MemberHelpers.getPathPropertyValue(_shared.libs, path)
      if (_.isUndefined(pathPropertyValue)) {
        Logger.warn('Lib \'' + path + '\' is undefined')
      }
      return pathPropertyValue
    }
  }

  self.setLib = function (path, lib) {
    MemberHelpers.setPathPropertyValue(_shared.libs, path, lib)
  }

  self.initializeModels = function () {
    _shared.models = ModuleLoader.optional({
      dirName: self.rootPath() + '/' + self.config('system.path.projects'),
      moduleDir: self.config('system.path.modules.models'),
      fileNameFilter: /(.+)\.(js)$/,
      mode: 'list',
      useVersions: true
    })
    // Add cronjob models too
    _.assign(_shared.models, ModuleLoader.optional({
      dirName: path.join(__dirname, '../../../lib/cronJobs/lib/'),
      fileNameFilter: /(cronJobExecutionModel|cronServerHeartbeatModel).js/,
      mode: 'list',
      useVersions: true
    }))
  }

  self.models = function (name) {
    if (!_shared.models) {
      self.initializeModels()
    }

    if (!name) {
      return _shared.models
    } else {

      var nameArray
      if (_.isArray(name)) {
        nameArray = name
      } else {
        nameArray = name.split('.')
        nameArray = _appendVersion(nameArray)
      }

      var modelPropertyValue = MemberHelpers.getPathPropertyValue(_shared.models, nameArray)
      if (_.isUndefined(modelPropertyValue)) {
        if (Logger) {
          Logger.warn('Model \'' + nameArray.join('.') + '\' is undefined')
        } else {
          console.log('Model \'' + nameArray.join('.') + '\' is undefined')
        }
      }

      return modelPropertyValue
    }
  }

  self.setModel = function (path, model) {
    MemberHelpers.setPathPropertyValue(_shared.models, path, model)
  }

  self.unsetModel = function (path) {
    _.unset(_shared.models, path)
  }

  self.newModelInstance = function (name) {
    var model = self.models(name)
    return new model()
  }

  self.initializeControllers = function () {
    _shared.controllers = ModuleLoader.optional({
      dirName: self.rootPath() + '/' + self.config('system.path.projects'),
      moduleDir: self.config('system.path.modules.controllers'),
      fileNameFilter: /(.+)\.(js)$/,
      mode: 'list',
      useVersions: true
    })
  }

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
    initPath = initPath || '/init'
    mode = mode || 'local'

    //load init
    _shared.init = ModuleLoader.optional({
      dirName: self.rootPath() + initPath,
      fileNameFilter: /(.+)\.(js)$/,
      mode: 'list'
    })

    var projectInit = ModuleLoader.optional({
      dirName: self.rootPath() + '/' + self.config('system.path.projects'),
      moduleDir: self.config('system.path.modules.init'),
      fileNameFilter: /(.+)\.(js)$/,
      mode: 'list'
    })

    //merge api init with system init
    _.assign(_shared.init, projectInit)
  }

  self.init = function (name) {
    if (!_shared.init) {
      self.initializeInit()
    }

    if (!name) {
      return _shared.init
    } else {
      var init = _shared.init[name]
      if (_.isUndefined(init)) {
        Logger.warn('Init \'' + name + '\' is undefined')
      }
      return init
    }
  }

  self.setInit = function (path, init) {
    MemberHelpers.setPathPropertyValue(_shared.init, path, init)
  }

  self.controllers = function (path) {
    if (!_shared.controllers) {
      self.initializeControllers()
    }

    if (!path) {
      return _shared.controllers
    } else {
      if (!_.isArray(path)) {
        path = [path, '1.0']
      }

      var controller = MemberHelpers.getPathPropertyValue(_shared.controllers, path)
      if (_.isUndefined(controller)) {
        Logger.warn('Controller \'' + path + '\' is undefined')
      }

      return controller
    }
  }

  self.setController = function (path, controller) {
    MemberHelpers.setPathPropertyValue(_shared.controllers, path, controller)
  }

  self.initialize = function (configPath, mode) {
    self.initializeConfig(configPath, mode)
    Logger = require('./../../logger')
    self.initializeDependencies()
  }

  self.initializeDependencies = function () {
    Logger.info('Initializing inits...')
    self.initializeInit()
    Logger.info('Initializing routes...')
    self.initializeRoutesConfig()
    Logger.info('Initializing models...')
    self.initializeModels()
    Logger.info('Initializing libs...')
    self.initializeLibs()
    Logger.info('Initializing controllers...')
    self.initializeControllers()
    Logger.info('Initializing crons...')
    self.initializeCronModules()
  }

  self.registerDbAdapter = function (name, adapter) {
    _shared.adapters = _shared.adapters || {}
    _shared.adapters[name] = adapter
  }

  self.adapters = function (name) {
    _shared.adapters = _shared.adapters || {}
    if (!name) {
      return _shared.adapters
    } else {
      return _shared.adapters[name]
    }
  }

  self.registerDbConnection = function (name, db, client) {
    _shared.dbconnection = _shared.dbconnection || {}
    _shared.dbconnection[name] = {
      'db': db,
      'client': client
    }
  }

  self.dbconnection = function (name) {
    _shared.dbconnection = _shared.dbconnection || {}
    if (!name) {
      return _shared.dbconnection
    } else {
      return _shared.dbconnection[name]
    }
  }

  self.registerService = function (service) {
    self.registeredServices().push(service)
  }

  self.registeredServices = function () {
    _shared.registeredServices = _shared.registeredServices || []
    return _shared.registeredServices
  }

  self.unregisterServices = function () {
    _shared.registeredServices = []
  }

  self.initializeCronModules = function () {
    _shared.cronModules = ModuleLoader.optional({
      dirName: self.rootPath() + '/' + self.config('system.path.projects'),
      moduleDir: self.config('system.path.modules.crons'),
      fileNameFilter: /(.+)\.(js)$/,
      mode: 'list'
    })
    // Add core modules too
    _.assign(_shared.cronModules, ModuleLoader.optional({
      dirName: path.join(__dirname, '../../../lib/cronJobs/lib/'),
      fileNameFilter: /(cronJobManagerJob).js/,
      mode: 'list'
    }))
  }

  self.cronModules = function (cronNames) {
    cronNames = typeof cronNames === 'string' ? [cronNames] : cronNames
    if (cronNames && !Array.isArray(cronNames)) {
      throw new MiaError(`invalid input. If input is passed it must be of format [cronNames]. Passed input: ${cronNames}`)
    }
    if (!_shared.cronModules) {
      self.initializeCronModules()
    }

    if (!cronNames || cronNames.length === 0) {
      return Object.values(_shared.cronModules) // returning all the registered cronJobs
    } else {
      const crons = cronNames.map(cronName => MemberHelpers.getPathPropertyValue(_shared.cronModules, cronName))
      if (crons.length === 0) {
        Logger.warn('Cron for \'' + crons.join(',') + '\' are undefined')
      }
      return crons.filter(c => c) // removing undefined values
    }
  }

  self.setCronModule = function (path, cronModule) {
    MemberHelpers.setPathPropertyValue(_shared.cronModules, path, cronModule)
  }

  var _memcached
  self.memcached = function (flush) {
    if (!_memcached) {
      var env = self.config('environment')

      if (env.defaultCache && env.defaultCache == 'memcached' && !env.memcached) {
        throw new MiaError('Memcached config settings \'memcached\' missing in environment config file')
      }

      if (!env.memcached) {
        return
      }

      var memcachedSettings = env.memcached || null

      if (memcachedSettings != null) {
        if (_.isEmpty(memcachedSettings.servers)) {
          throw new MiaError('Memcached config settings \'servers\' missing')
        }
        if (_.isEmpty(memcachedSettings.options)) {
          throw new MiaError('Memcached config settings \'options\' missing')
        }
        _memcached = new Memcached(memcachedSettings.servers, memcachedSettings.options)

        _memcached.on('issue', function (details) {
          Logger.error('Memcached: Server ' + details.server + ' has an issue: ' + details.messages.slice(-1).pop())
        })
        _memcached.on('failure', function (details) {
          Logger.error('Memcached: Server ' + details.server + ' went down due to: ' + details.messages.slice(-1).pop())
        })

        _memcached.on('remove', function (details) {
          Logger.error('Memcached cache ' + details.server + ' removed from consistent hashing due to: ' + details.messages.slice(-1).pop())
        })

        if (flush == true && memcachedSettings.flushOnStart === true) {
          _memcached.flush(function (err) {
            if (!err) {
              Logger.info('Flushed memcache')
            }
          })
        }
      }
    }
    return _memcached
  }

  var _redis
  self.redis = function (flush) {
    return Promise.resolve()
      .then(function () {
        if (!_redis) {
          var env = self.config('environment')

          if (env.defaultCache && env.defaultCache === 'redis' && !env.redis) {
            throw new MiaError('Redis cache config settings \'redis\' missing in environment config file')
          }

          if (!env.redis) {
            return
          }

          var redisSettings = env.redis || {}

          if (redisSettings) {

            redisSettings.options = redisSettings.options || {}

            redisSettings.options = redisSettings.options || {}
            redisSettings.options.retryStrategy = redisSettings.options.retryStrategy || function (times) {
              if (times > 1) {
                return false
              }
            }

            if (redisSettings.clusterServers && _.isArray(redisSettings.clusterServers)) {
              if (redisSettings.clusterServers.length === 0) {
                throw new MiaError('Redis clusterServers is an empty array. Provide at least one server')
              }

              redisSettings.options['clusterRetryStrategy'] = redisSettings.options['clusterRetryStrategy'] || function (times) {
                if (times > 1) {
                  return false
                }
              }

              redisSettings.options.redisOptions = redisSettings.options.redisOptions || {}
              redisSettings.options.redisOptions.retryStrategy = redisSettings.options.redisOptions.retryStrategy || function (times) {
                if (times > 1) {
                  return false
                }
              }

              _redis = new Redis.Cluster(redisSettings.clusterServers, redisSettings.options)
            } else {
              _redis = new Redis(redisSettings.options)
            }

            _redis.on('error', function (err) {
              Logger.error('Redis cache error', err)
            })

            _redis.on('close', function close () {
              _redis = undefined
            })

            _redis.on('end', function close () {
              _redis = undefined
            })

            if (flush === true && redisSettings.flushOnStart === true) {
              _redis.flushdb(function (err) {
                if (!err) {
                  Logger.info('Flushed redis cache')
                }
              })
            }
          }
        }
        return _redis
      })
      .catch(function (err) {
        Logger = require('./../../logger')
        Logger.error('Unexpected redis error occurred', err)
      })
  }

  self.setDbAvailableConnections = function (dbConnections) {
    _shared.availableDbConnections = dbConnections
  }

  self.isDbConnectionAvailable = function () {
    return !_.isEmpty(_shared.availableDbConnections)
  }

  var _httpKeepaliveAgent
  var _httpsKeepaliveAgent
  self.keepAliveAgent = function (protocol) {
    var defaultKeepAliveAgentOptions = {
      maxSockets: 1024,
      maxFreeSockets: 10,
      timeout: 60000,
      keepAliveTimeout: 30000 // free socket keepalive for 30 seconds
    }
    var env = self.config('environment')

    if (protocol == 'https') {
      if (!_httpKeepaliveAgent) {
        _httpsKeepaliveAgent = new HttpsAgent(env.keepAliveAgentOptions || defaultKeepAliveAgentOptions)
      }
      return _httpsKeepaliveAgent
    } else {
      if (!_httpKeepaliveAgent) {
        _httpKeepaliveAgent = new Agent(env.keepAliveAgentOptions || defaultKeepAliveAgentOptions)
      }
      return _httpKeepaliveAgent
    }
  }

  /**
   * Parses the arguments values given eg. "cron=NameOfCronjobToStart,NameOfAnotherCronjobToStart" will be
   * ['NameOfCronjobToStart', 'NameOfAnotherCronjobToStart']
   *
   * @returns {Array} Values
   * @private
   */
  self.getRuntimeArgumentsValues = function (argument) {
    const valuesString = _.get(self, ['runtimeArgs', argument]);
    if (_.isString(valuesString)) {
      const values = valuesString.replace(/\s/g, '').split(',');
      return values.length > 0 ? values : [];
    }
    return [];
  };

  return self
}

module.exports = new thisModule()
