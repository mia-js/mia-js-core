const webpack = require('webpack');
const path = require('path');
const nodeExternals = require('webpack-node-externals');
const basePath = process.cwd();
const HotMia = require('../webpackPlugins/HotMia');

let config = {
    mode: 'development',
    name: 'devServer',
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
    config.plugins.push(new HotMia({basePath, mappingsFilePath, reInitRoutesInterval: 1000}));

    return config;
};
