/**
 * Module dependencies
 */

/**
 * Module loader
 *
 * Load a module into memory
 */

var Loader = require('./lib/requireAll.js');

/**
 * Build a dictionary of named modules
 * (responds with an error if the container cannot be loaded)
 *
 * @param {Object} options
 */
module.exports.required = function (options) {
    return Loader.requireAll(options);
};


/**
 * Build a dictionary of named modules
 * (fails silently-- returns {} if the container cannot be loaded)
 *
 * @param {Object} options
 */
module.exports.optional = function (options) {
    options.optional = true;
    return Loader.requireAll(options);
};

/**
 * Build a dictionary indicating whether the matched modules exist
 * (fails silently-- returns {} if the container cannot be loaded)
 *
 * @param {Object} options
 */
module.exports.exists = function (options) {
    options.optional = true;
    options.dontLoad = false;
    return Loader.requireAll(options);
};

