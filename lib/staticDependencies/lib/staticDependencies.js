const _ = require('lodash');
const Q = require('q');
const fs = require('fs');
const path = require('path');

/**
 * @param {Object} Logger
 * @param {Object} Shared
 * @param {Object} config
 * @returns {StaticDependencies}
 * @constructor
 */
function StaticDependencies(Logger, Shared, config) {
    let self = this;
    let _sharedInitialized = false;

    // Set config defaults
    config = _.defaults(config, {
        filePath: __dirname,
        fileNameExclude: undefined,
        initializeShared: false
    });
    Logger = Logger.tag('StaticDependencies');

    /**
     * Create static dependencies file
     * @param {String} fileName
     * @param {Boolean} hmr
     * @returns {*}
     */
    self.createImportsFile = (fileName, hmr = false) => {

        Logger.info('Going to create static dependencies file');

        let writeBefore;
        if (hmr) {
            writeBefore = () => {
                return `const MiaJs = require('mia-js-core');\n` +
                    `const Shared = require('mia-js-core/lib/shared');\n` +
                    `const CronJobManagerJob = Shared.cronModules('generic-cronJobManagerJob')[0];\n` +
                    `const reInitializeRoutes = () => {bool = true; counter = 0};\n` +
                    `let bool = false;\n` +
                    `let counter = 0;\n` +
                    `const interval = setInterval(() => {counter +=1; if(counter == 1 && bool){MiaJs.Run.reInitRoutes(); bool = false}}, 1000);\n`;
            };
        }

        const write = (path, dependency) => {
            if (hmr) {
                return `let ${_getVariableName(dependency)} = require('${dependency.absoluteFullPath}');\n`;
            }
            return `require('${dependency.absoluteFullPath}');\n`;
        };

        return _createFile(fileName, hmr, write, writeBefore)
            .then(() => Logger.info('File successfully created'));
    };

    /**
     * Create mappings file
     * @param {String} fileName
     * @returns {*}
     */
    self.createMappingsFile = fileName => {

        Logger.info('Going to create mappings file');

        const writeBefore = () => {
            return `const mappings = {};\n`;
        };

        const write = (path, dependency, sharedFunctionName) => {
            const version = _.isUndefined(dependency.version) ? '1.0' : dependency.version;
            return `if(!mappings['${sharedFunctionName}']) mappings['${sharedFunctionName}'] = {}; ` +
                `if(!mappings['${sharedFunctionName}']['${dependency.identity}']) mappings['${sharedFunctionName}']['${dependency.identity}'] = {};\n` +
                `mappings['${sharedFunctionName}']['${dependency.identity}']['${version}'] = '${dependency.absoluteFullPath}';\n`;
        };

        const writeAfter = () => {
            return `module.exports = mappings;\n`;
        };

        return _createFile(fileName, false, write, writeBefore, writeAfter)
            .then(() => Logger.info('File successfully created'));
    };

    /**
     * Gets variable name for dependency
     * @private
     * @param {Object} dependency
     * @returns {String}
     */
    const _getVariableName = dependency => {
        return dependency.absoluteFullPath.replace(/\/|-|.js/g, '');
    };

    /**
     * @private
     * @param {String} fileName
     * @param {Boolean} hmr
     * @param {Function} write
     * @param {Function} writeBefore
     * @param {Undefined|Function} writeAfter
     */
    const _createFile = (fileName, hmr, write, writeBefore = undefined, writeAfter = undefined) => {

        if (!fs.existsSync(config.filePath)) {
            fs.mkdirSync(config.filePath);
        }
        const stream = fs.createWriteStream(path.join(config.filePath, fileName));
        const deferred = Q.defer();

        stream.once('open', () => {
            Q()
                .then(() => {
                    if (_.isFunction(writeBefore)) {
                        stream.write(writeBefore());
                    }
                })
                // Initialize all dependencies
                .then(() => {
                    if (config.initializeShared && !_sharedInitialized) {
                        Shared.initialize();
                        _sharedInitialized = true;
                    }
                })
                .then(() => {
                    let config = _.cloneDeep(Shared.config());
                    delete(config['environment']);
                    return _writeOut(write, stream, config, 'config', hmr);
                })
                .then(() => {
                    return _writeOut(write, stream, Shared.init(), 'init', hmr);
                })
                .then(() => {
                    return _writeOut(write, stream, Shared.routesConfig(), 'routesConfig', hmr);
                })
                .then(() => {
                    return _writeOut(write, stream, Shared.models(), 'models', hmr);
                })
                .then(() => {
                    return _writeOut(write, stream, Shared.libs(), 'libs', hmr);
                })
                .then(() => {
                    return _writeOut(write, stream, Shared.controllers(), 'controllers', hmr);
                })
                .then(() => {
                    return _writeOut(write, stream, Shared.cronModules(), 'cronModules', hmr);
                })
                .then(() => {
                    if (_.isFunction(writeAfter)) {
                        stream.write(writeAfter());
                    }
                })
                .then(() => {
                    stream.end();
                })
                .catch(error => {
                    Logger.error(error);
                });
        });
        stream.on('finish', () => {
            return deferred.resolve();
        });
        stream.on('error', error => {
            return deferred.reject(error);
        });

        return deferred.promise;
    };

    /**
     * Write dependencies into file
     * @param {Function} write
     * @param {Object} stream
     * @param {Object} dependencies
     * @param {String} sharedFunctionName
     * @param {Boolean} hmr
     * @param {Undefined|Array} path
     * @returns {*}
     * @private
     */
    const _writeOut = (write, stream, dependencies, sharedFunctionName, hmr, path = undefined) => {
        path = _.isUndefined(path) ? [] : path;
        for (let key in dependencies) {
            if (!dependencies.hasOwnProperty(key)) continue;
            let dependency = dependencies[key];

            if (!_.isUndefined(dependency.fileName) && config.fileNameExclude) {
                if (dependency.fileName.match(config.fileNameExclude)) {
                    // Exclude dependency file
                    continue;
                }
            }

            path.push(key);

            if (!_.isUndefined(dependency.absoluteFullPath)) {
                stream.write(write(path, dependency, sharedFunctionName));

                if (hmr) {
                    _writeOutHMRListeners(stream, path, dependency, sharedFunctionName);
                }

            } else if (_.isObject(dependency) && !_.isArray(dependency)) {
                _writeOut(write, stream, dependency, sharedFunctionName, hmr, path);
            }
            path.pop();
        }
        return Q();
    };

    /**
     * Add HMR listeners to file
     * @param {Object} stream
     * @param {Array} path
     * @param {Object} dependency
     * @param {String} sharedFunctionName
     * @private
     */
    const _writeOutHMRListeners = (stream, path, dependency, sharedFunctionName) => {
        const variable = _getVariableName(dependency);

        switch (sharedFunctionName) {
            case 'config':
                // @todo Reinitialization of configs missing
                //stream.write(`if(module.hot)module.hot.accept('${dependency.absoluteFullPath}', () => {console.log('[HMR] Changed config file with identity "${dependency.identity}"'); ${variable} = require('${dependency.absoluteFullPath}');});\n`);
                break;
            case 'init':
                stream.write(`if(module.hot)module.hot.accept('${dependency.absoluteFullPath}', () => {console.log('[HMR] Changed init file with identity "${dependency.identity}"'); ${variable} = require('${dependency.absoluteFullPath}'); Shared.setInit([${path.map(p => "'" + p + "'").join(', ')}], ${variable})});\n`);
                break;
            case 'routesConfig':
                stream.write(`if(module.hot)module.hot.accept('${dependency.absoluteFullPath}', () => {console.log('[HMR] Changed routes config file with identity "${dependency.identity}"'); ${variable} = require('${dependency.absoluteFullPath}'); Shared.setRoutesConfig([${path.map(p => "'" + p + "'").join(', ')}], ${variable}); reInitializeRoutes()});\n`);
                break;
            case 'models':
                stream.write(`if(module.hot)module.hot.accept('${dependency.absoluteFullPath}', () => {console.log('[HMR] Changed model file with identity "${dependency.identity}"'); ${variable} = require('${dependency.absoluteFullPath}'); Shared.setModel([${path.map(p => "'" + p + "'").join(', ')}], ${variable})});\n`);
                break;
            case 'libs':
                stream.write(`if(module.hot)module.hot.accept('${dependency.absoluteFullPath}', () => {console.log('[HMR] Changed lib file with identity "${dependency.identity}"'); ${variable} = require('${dependency.absoluteFullPath}'); Shared.setLib([${path.map(p => "'" + p + "'").join(', ')}], ${variable})});\n`);
                break;
            case 'controllers':
                stream.write(`if(module.hot)module.hot.accept('${dependency.absoluteFullPath}', () => {console.log('[HMR] Changed controller file with identity "${dependency.identity}"'); ${variable} = require('${dependency.absoluteFullPath}'); Shared.setController([${path.map(p => "'" + p + "'").join(', ')}], ${variable}); reInitializeRoutes()});\n`);
                break;
            case 'cronModules':
                stream.write(`if(module.hot)module.hot.accept('${dependency.absoluteFullPath}', () => {console.log('[HMR] Changed cron module file with identity "${dependency.identity}"'); ${variable} = require('${dependency.absoluteFullPath}'); Shared.setCronModule([${path.map(p => "'" + p + "'").join(', ')}], ${variable}); ${variable}.initializeJob(CronJobManagerJob.getUniqueServerId())});\n`);
                break;
        }
    };

    return self;
}

module.exports = StaticDependencies;
