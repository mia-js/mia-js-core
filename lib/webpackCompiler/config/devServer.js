const path = require('path');
const chalk = require('chalk');
const webpack = require('webpack');
const nodeExternals = require('webpack-node-externals');
const HotMia = require('../webpackPlugins/HotMia');
const ProgressBarPlugin = require('progress-bar-webpack-plugin');
const basePath = process.cwd();
const bundleName = 'devServer';

let config = {
    mode: 'development',
    name: bundleName,
    entry: [
        //'webpack/hot/poll?1000',
        path.join(basePath, 'server.js')
    ],
    watch: true,
    target: 'node',
    externals: [nodeExternals({
        whitelist: [/*'webpack/hot/poll?1000',*/ /mia-js-core/]
    })],
    module: {
        rules: [{
            test: /\.js?$/,
            exclude: /mia-js-core/,
            use: {
                loader: 'babel-loader',
                options: {
                    presets: [
                        [
                            '@babel/preset-env',
                            {
                                targets: {
                                    node: true
                                }
                            }
                        ]
                    ],
                    plugins: [
                        [
                            path.join(__dirname, '../babelPlugins/dependencies.js'),
                            {mappingsFile: ''}
                        ],
                        //path.join(__dirname, '../babelPlugins/hotCronJobs.js')
                    ],
                    ignore: [
                        '**/*.dist.js'
                    ]
                }
            }
        }]
    },
    plugins: [
        //new webpack.HotModuleReplacementPlugin(),
        new webpack.NoEmitOnErrorsPlugin(),
        new webpack.DefinePlugin({
            'process.env': {
                'BUILD_TARGET': JSON.stringify('server')
            }
        }),
        new ProgressBarPlugin({
            format: chalk.greenBright(`${bundleName} [:bar] :percent (:elapsed seconds)`),
            summary: false
        })
    ],
    output: {
        path: path.join(__dirname, '../.webpack'),
        filename: 'server.js'
    },
    stats: 'none'
};

module.exports = mappingsFileName => {
    const mappingsFilePath = path.join(config.output.path, mappingsFileName);

    config.module.rules[0].use.options.plugins[0][1].mappingsFile = mappingsFilePath;
    config.plugins.push(new HotMia({
        basePath,
        mappingsFilePath
    }));

    return config;
};
