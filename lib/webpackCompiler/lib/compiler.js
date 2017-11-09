const Q = require('q');
const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const webpack = require('webpack');
const webpackDevMiddleware = require('webpack-dev-middleware');
const webpackHotMiddleware = require('webpack-hot-middleware');
const webpackServerRenderMiddleware = require('webpack-server-render-middleware').default;

function Compiler(Logger, Shared, config) {
    var self = this;

    config = _.defaults(config, {
        configFiles: {
            clientPattern: /webpack.client.([a-zA-Z]+).config.js/,
            serverPattern: /webpack.server.([a-zA-Z]+).config.js/
        }
    });

    env = Shared.config('environment');
    Logger = Logger.tag('WebpackCompiler');

    self.compile = () => {

        if (_.isUndefined(env.webpack) || _.isUndefined(env.webpack.skip) || (!_.isUndefined(env.webpack) && !_.isUndefined(env.webpack.skip) && env.webpack.skip)) {
            Logger.info(`Skipping compilation of webpack projects for environment '${env.identity}'`);
            return Q();
        }

        Logger.info(`Compiling webpack projects for environment '${env.identity}'`);

        return _loadWebpackConfigFiles()
            .then(configFiles => {
                let seq = Q();
                for (let index in configFiles) {
                    // Compile projects in sequence
                    seq = seq.then(() => {
                        return _compileProject(configFiles[index])
                    });
                }
                return seq;
            })
            .then(() => Logger.info('All webpack projects successfully compiled'))
    }

    /**
     * @returns {Promise}
     * @private
     */
    const _loadWebpackConfigFiles = () => {
        const allProjectsPath = Shared.projectPath();
        const clientRegExp = new RegExp(config.configFiles.clientPattern);
        const serverRegExp = new RegExp(config.configFiles.serverPattern);
        let configFiles = [];

        fs.readdirSync(allProjectsPath).forEach(project => {
            let projectPath = path.join(allProjectsPath, project);
            let stats = fs.lstatSync(projectPath);
            let projectConfigFiles = {
                project: project,
                client: {},
                server: {}
            }

            if (stats.isDirectory()) {
                fs.readdirSync(projectPath).forEach(element => {
                    let match;
                    if (match = element.match(clientRegExp)) {
                        projectConfigFiles.client[match[1]] = path.join(projectPath, element);
                    } else if (match = element.match(serverRegExp)) {
                        projectConfigFiles.server[match[1]] = path.join(projectPath, element);
                    }
                });

                if (!_.isEmpty(projectConfigFiles.client) || !_.isEmpty(projectConfigFiles.server)) {
                    configFiles.push(projectConfigFiles);
                }
            }
        });

        return Q(configFiles);
    }

    /**
     * @param {Object} projectConfig
     * @returns {Promise}
     * @private
     */
    const _compileProject = (projectConfig) => {
        const projectName = projectConfig.project;

        let clientWatchConfig;
        let clientFsConfig;
        let serverWatchConfig;
        let serverFsConfig;

        if (env.webpack && env.webpack.watchMode) {

            Logger.info(`Compiling project '${projectName}' to memory and serving through webpack-dev-middleware with HMR`);

            if (projectConfig.client.watch) {
                clientWatchConfig = require(projectConfig.client.watch);
            }
            if (projectConfig.server.watch) {
                serverWatchConfig = require(projectConfig.server.watch);
            }

            return _purgePriorBundleFiles(clientWatchConfig, serverWatchConfig)
                .then(() => _compileAndWatchBundle(clientWatchConfig, serverWatchConfig))
                .then(() => Logger.info(`Compiled project '${projectName}' successfully`));

        } else {

            Logger.info(`Compiling project '${projectName}' to filesystem`);

            if (projectConfig.client.fs) {
                clientFsConfig = require(projectConfig.client.fs);
            }
            if (projectConfig.server.fs) {
                serverFsConfig = require(projectConfig.server.fs);
            }

            return _purgePriorBundleFiles(clientFsConfig, serverFsConfig)
                .then(() => _compileBundle(clientFsConfig, serverFsConfig))
                .then(() => Logger.info(`Compiled project '${projectName}' successfully`));
        }
    }

    /**
     * @param {Module} clientConfig
     * @param {Module} serverConfig
     * @returns {Promise}
     * @private
     */
    const _compileAndWatchBundle = (clientConfig, serverConfig) => {
        let configs = [];
        let clientCompiler;
        let serverCompiler;
        let promises = [];

        if (clientConfig) {
            configs = configs.concat(clientConfig);
        }
        if (serverConfig) {
            configs = configs.concat(serverConfig);
        }

        const compilers = webpack(configs);
        const appHttp = Shared.appHttp();

        if (clientConfig) {
            const compileClient = () => {
                return Q.Promise((resolve, reject) => {
                    clientCompiler = compilers.compilers.find(compiler => compiler.name === clientConfig.name);

                    clientCompiler.plugin('done', (stats) => {
                        Logger.info(`Stats for bundle '${clientCompiler.name}':`);
                        Logger.info(stats.toString(_getStatsConfiguration()));
                        return resolve();
                    });

                    appHttp.use(webpackDevMiddleware(clientCompiler, {
                        publicPath: clientConfig.output.publicPath,
                        quiet: true
                    }));
                    // Only the client bundle needs to be passed to 'webpack-hot-middleware'
                    appHttp.use(webpackHotMiddleware(clientCompiler, {
                        path: clientConfig.output.publicPath + '__webpack_hmr',
                        log: Logger.info
                    }));
                });
            };
            promises.push(compileClient());
        }
        if (serverConfig) {
            const compileServer = () => {
                return Q.Promise((resolve, reject) => {
                    serverCompiler = compilers.compilers.find(compiler => compiler.name === serverConfig.name);

                    serverCompiler.plugin('done', (stats) => {
                        Logger.info(`Stats for bundle '${serverCompiler.name}':`);
                        Logger.info(stats.toString(_getStatsConfiguration()));
                        return resolve();
                    });

                    appHttp.use(webpackServerRenderMiddleware(serverCompiler, {
                        aggregateTimeout: 1000,
                        quiet: true
                    }));
                });
            };
            promises.push(compileServer());
        }

        return Q.all(promises);
    }

    /**
     * @param {Object} clientConfig
     * @param {Object} serverConfig
     * @returns {Promise}
     * @private
     */
    const _purgePriorBundleFiles = (clientConfig, serverConfig) => {

        if (!env.webpack || !env.webpack.purge) {
            Logger.info('Skipping purge of prior bundle files');
            return Q();
        }

        let files = [];
        let promises = [];

        if (clientConfig) {
            files.push(clientConfig.output.path);
        }
        if (serverConfig) {
            files.push(path.join(serverConfig.output.path, serverConfig.output.filename));
        }

        Logger.info('Going to purge prior bundle files');

        files.forEach(file => {
            promises.push(_unlinkRecursive(file));
        })
        return Q.all(promises)
            .then(() => Logger.info('Prior bundle files purged successfully'));
    }

    /**
     * @param {String} file
     * @param {Boolean} childLevel
     * @returns {Promise}
     * @private
     */
    const _unlinkRecursive = (file, childLevel = false) => {
        return Q.nfcall(fs.lstat, file)
            .then(stats => {
                if (stats && stats.isFile()) {
                    return Q.nfcall(fs.unlink, file);

                } else if (stats && stats.isDirectory()) {
                    return Q.nfcall(fs.readdir, file)
                        .then(filesInDir => {
                            let promisesInDir = [];
                            filesInDir.forEach(fileInDir => {
                                promisesInDir.push(_unlinkRecursive(path.join(file, fileInDir), true));
                            })
                            return Q.all(promisesInDir);
                        })
                        .then(() => {
                            if (childLevel) {
                                // Don't remove output path dir
                                return Q.nfcall(fs.rmdir, file);
                            }
                        })
                }
            })
            .catch(err => {
                // Continue with next file
            })
    }

    /**
     * @param {Module} clientConfig
     * @param {Module} serverConfig
     * @returns {Promise}
     * @private
     */
    const _compileBundle = (clientConfig, serverConfig) => {
        return Q.Promise((resolve, reject) => {
            let configs = [];
            let bundleNames = [];

            if (clientConfig) {
                configs = configs.concat(clientConfig);
                bundleNames.push(`'${clientConfig.name}'`);
            }
            if (serverConfig) {
                configs = configs.concat(serverConfig);
                bundleNames.push(`'${serverConfig.name}'`);
            }

            const compilers = webpack(configs);

            compilers.run((err, stats) => {
                if (err) {
                    Logger.error(err);
                    return reject(err);
                }
                Logger.info(`Stats for bundles ${bundleNames.join(',')}:`);
                Logger.info(stats.toString(_getStatsConfiguration()));
                return resolve();
            });
        });
    }

    /**
     * @returns {Object}
     * @private
     */
    const _getStatsConfiguration = () => {
        const verbose = !_.isUndefined(env.webpack) && !_.isUndefined(env.webpack.verbose) && env.webpack.verbose;

        return {
            assets: verbose,
            chunks: true,
            colors: true,
            errors: true,
            errorDetails: true,
            hash: verbose,
            maxModules: verbose ? Infinity : 0,
            modulesSort: 'size',
            version: verbose,
            warnings: true
        }
    }

    return self;
};

module.exports = Compiler;
