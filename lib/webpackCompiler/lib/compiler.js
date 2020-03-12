const Q = require('q');
const fs = require('fs-extra');
const path = require('path');
const _ = require('lodash');
const webpack = require('webpack');
const webpackDevMiddleware = require('webpack-dev-middleware');
const webpackHotMiddleware = require('webpack-hot-middleware');
const webpackServerRenderMiddleware = require('webpack-server-render-middleware').default;
const staticDependencies = require('../../staticDependencies');
const MiaError = require('../../errorHandler/lib/error');

function Compiler(LoggerTagLess, Shared, config) {
    const Logger = LoggerTagLess.tag('WebpackCompiler');
    let self = this;

    config = _.defaults(config, {
        /**
         * Regex pattern to find relevant webpack configuration files. For example webpack.config.js,
         * webpack.something.config.js or webpack.some.thing.config.js
         */
        configFilesPattern: /^webpack.([a-zA-Z]+\.){0,2}config.js/,
        clientHMRPattern: /\.client\.hmr\./,
        serverHMRPattern: /\.server\.hmr\./,
        devServer: {
            configFile: 'devServer.js',
            // Regex to ignore matching dependency files
            fileNameExclude: /.dist.js|cronJobManagerJob.js/,
            importsFileName: 'staticDependencies.js',
            mappingsFileName: 'dependenciesMappings.js'
        }
    });

    self.compile = () => {
        const env = Shared.config('environment');
        const hmrArgumentValues = Shared.getRuntimeArgumentsValues('hmr');
        const hmr = Shared.runtimeArgs.hmr === true || hmrArgumentValues.length > 0;
        const build = Shared.runtimeArgs.build;

        if (!build && !hmr) {
            return Q();
        }

        Logger.info(`Compiling webpack projects for environment '${env.identity}'`);

        return _loadWebpackConfigFiles()
            .then(projectFiles => {
                let seq = Q();
                for (const project of projectFiles) {
                    // Compile projects in sequence
                    seq = seq.then(() => {
                        return _compileProject(project)
                    });
                }
                return seq;
            })
            .then(() => Logger.info('All webpack projects successfully compiled'))
    };

    self.compileServer = () => {
        const serverConfig = config.devServer;
        const configFilePath = path.join(__dirname, '../config/', serverConfig.configFile);

        if (!fs.existsSync(configFilePath)) {
            return Q.reject(new MiaError('Webpack config file for development server not found - Skipping compilation!'));

        }

        const webpackConfig = require(configFilePath)(serverConfig.mappingsFileName);
        const outputPath = webpackConfig.output.path;

        const hmrArgumentValues = Shared.getRuntimeArgumentsValues('hmr');
        const hmr = Shared.runtimeArgs.hmr === true || hmrArgumentValues.indexOf(webpackConfig.name) !== -1;

        if (!hmr) {
            return Q();
        }

        return fs.remove(outputPath)
            .then(() => {
                const StaticDependencies = new staticDependencies(LoggerTagLess, Shared, {
                    filePath: outputPath,
                    fileNameExclude: serverConfig.fileNameExclude
                });

                return StaticDependencies.createImportsFile(serverConfig.importsFileName)
                    .then(() => StaticDependencies.createMappingsFile(serverConfig.mappingsFileName))
                    // ATTENTION: Because of webpack's static code analysis we can't use the configured output path
                    // IMPORTANT: If you change the output path in devServer.configFile you have to change it here as well!
                    .then(() => require('../.webpack/staticDependencies.js'));
            })
            .then(() => {
                return Q.Promise(resolve => {
                    Logger.info('Going to build development server because we want to use HMR...');

                    // @see https://github.com/webpack/watchpack/issues/25
                    setTimeout(() => {
                        webpack(webpackConfig, (err, stats) => {
                            Logger.info('Build done.');

                            if (err) {
                                Logger.error(err);
                            }

                            const statsAsString = stats.toString(_.isUndefined(webpackConfig.stats) ? _getStatsConfiguration() : webpackConfig.stats);

                            if (statsAsString) {
                                Logger.info(`Stats for development server:`);
                                Logger.info(statsAsString);
                            }
                            return resolve();
                        });
                    }, 1000);
                });
            });
    };

    /**
     * @returns {Promise}
     * @private
     */
    const _loadWebpackConfigFiles = () => {
        const allProjectsPath = Shared.projectPath();
        let configFiles = [];

        fs.readdirSync(allProjectsPath).forEach(project => {
            let projectPath = path.join(allProjectsPath, project);
            let stats = fs.lstatSync(projectPath);
            let projectConfigFiles = {
                project: project,
                hmr: {
                    client: undefined,
                    server: undefined
                },
                fs: []
            };

            if (stats.isDirectory()) {
                fs.readdirSync(projectPath).forEach(element => {
                    if (element.match(config.configFilesPattern)) {
                        if (element.match(config.clientHMRPattern)) {
                            projectConfigFiles.hmr.client = path.join(projectPath, element);
                        } else if (element.match(config.serverHMRPattern)) {
                            projectConfigFiles.hmr.server = path.join(projectPath, element);
                        } else {
                            projectConfigFiles.fs.push(path.join(projectPath, element));
                        }
                    }
                });

                if (!_.isUndefined(projectConfigFiles.hmr.client) || !_.isUndefined(projectConfigFiles.hmr.server) || !_.isEmpty(projectConfigFiles.fs)) {
                    configFiles.push(projectConfigFiles);
                }
            }
        });

        return Q(configFiles);
    };

    /**
     * @param {Object} projectConfig
     * @returns {Promise}
     * @private
     */
    const _compileProject = projectConfig => {
        const projectName = projectConfig.project;
        const hmrArgumentValues = Shared.getRuntimeArgumentsValues('hmr');
        const hmr = Shared.runtimeArgs.hmr === true || hmrArgumentValues.indexOf(projectName) !== -1;
        const build = Shared.runtimeArgs.build;

        if (hmr && (projectConfig.hmr.client || projectConfig.hmr.server)) {

            Logger.info(`Compiling project '${projectName}' to memory and serving through webpack-dev-middleware with HMR`);

            let clientHMRConfig, serverHMRConfig;

            if (projectConfig.hmr.client) {
                clientHMRConfig = require(projectConfig.hmr.client);
            }
            if (projectConfig.hmr.server) {
                serverHMRConfig = require(projectConfig.hmr.server);
            }

            return _compileAndWatchBundle(clientHMRConfig, serverHMRConfig)
                .then(() => Logger.info(`Compiled project '${projectName}' successfully`));

        } else if (!hmr && build && projectConfig.fs.length) {

            Logger.info(`Compiling project '${projectName}' to filesystem`);

            let bundleConfigs = [];
            for (let configFile of projectConfig.fs) {
                const jsonConfig = require(configFile);
                bundleConfigs.push({
                    file: configFile,
                    config: jsonConfig
                })
            }

            return _compileBundles(bundleConfigs)
                .then(() => Logger.info(`Compiled project '${projectName}' successfully`));
        }
    };

    /**
     * @param {Module} clientConfig
     * @param {Module} serverConfig
     * @returns {Promise}
     * @private
     */
    const _compileAndWatchBundle = (clientConfig, serverConfig) => {
        let promises = [];

        const appHttp = Shared.appHttp();
        const appHttps = Shared.appHttps();

        if (clientConfig) {
            const compileClient = () => {
                return Q.Promise(resolve => {
                    const clientCompiler = webpack(clientConfig);

                    clientCompiler.plugin('done', (stats) => {
                        Logger.info(`Stats for bundle '${clientCompiler.name}':`);
                        Logger.info(stats.toString(_.isUndefined(clientConfig.stats) ? _getStatsConfiguration() : clientConfig.stats));
                        return resolve();
                    });

                    const DevMiddleware = webpackDevMiddleware(clientCompiler, {
                        publicPath: clientConfig.output.publicPath,
                        quiet: true
                    });
                    // Only the client bundle needs to be passed to 'webpack-hot-middleware'
                    const HotMiddleware = webpackHotMiddleware(clientCompiler, {
                        path: `${clientConfig.output.publicPath}__webpack_hmr`,
                        log: Logger.info
                    });

                    appHttp.use(DevMiddleware);
                    appHttp.use(HotMiddleware);
                    appHttps.use(DevMiddleware);
                    appHttps.use(HotMiddleware);
                });
            };
            promises.push(compileClient());
        }
        if (serverConfig) {
            const compileServer = () => {
                return Q.Promise(resolve => {
                    const serverCompiler = webpack(serverConfig);

                    serverCompiler.plugin('done', (stats) => {
                        Logger.info(`Stats for bundle '${serverCompiler.name}':`);
                        Logger.info(stats.toString(_.isUndefined(serverConfig.stats) ? _getStatsConfiguration() : serverConfig.stats));
                        return resolve();
                    });

                    const ServerRenderMiddleware = webpackServerRenderMiddleware(serverCompiler, {
                        aggregateTimeout: 1000,
                        quiet: true
                    });

                    appHttp.use(ServerRenderMiddleware);
                    appHttps.use(ServerRenderMiddleware);
                });
            };
            promises.push(compileServer());
        }

        return Q.all(promises);
    };

    /**
     * @param {Array} bundleConfigs
     * @returns {Promise}
     * @private
     */
    const _compileBundles = (bundleConfigs) => {
        return Q.Promise((resolve, reject) => {
            let configs = [];
            let bundleNames = [];

            bundleConfigs.map(bC => {
                configs = configs.concat(bC.config);
                bundleNames.push(`'${bC.config.name}'`);
            });

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
    };

    /**
     * @returns {Object}
     * @private
     */
    const _getStatsConfiguration = () => {
        const env = Shared.config('environment');
        const verbose = !_.isUndefined(env.webpack) && !_.isUndefined(env.webpack.verbose) && env.webpack.verbose;

        return {
            assets: verbose,
            chunks: true,
            chunkModules: false,
            colors: true,
            errors: true,
            errorDetails: true,
            hash: verbose,
            maxModules: verbose ? Infinity : 0,
            modulesSort: 'size',
            version: verbose,
            warnings: false
        }
    };

    return self;
}

module.exports = Compiler;
