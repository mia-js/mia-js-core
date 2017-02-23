/**
 * Custom logging function like console.log
 * @param app
 * @returns {module}
 */

var _ = require('lodash');
var Shared = require('./../../shared');
var Util = require('util');

function thisModule() {

    var self = this;

    /**
     * Write logging information
     * @param level => 'none', 'fatal', 'error', 'warn', 'info', 'debug', 'trace'
     * @param message = >Error message
     * @param tag => Tags of log info i.e. database, request. Default is 'default' or empty
     * @param data => Any data object
     * @private
     */
    var _logEvent = function (level, message, tag, data) {

        var env = Shared.config('environment');
        var levels = ['fatal', 'error', 'warn', 'info', 'debug', 'trace']
            , logLevelConfig = env.logLevel || "info";

        if (logLevelConfig == "none") {
            return;
        }

        level = level.toLowerCase();
        var logLevel = levels.indexOf(logLevelConfig) >= 0 ? logLevelConfig : 'info';
        data = data || "";

        // Set default error logging
        if (_.isObject(message) && _.isEmpty(data)) {
            if (message.message && _.isString(message.message)) {
                data = message.stack || "";
                message = message.message;
            }
            else {
                data = message;
                message = null;
            }
        }

        //Output
        if (levels.indexOf(level) <= levels.indexOf(logLevel)) {
            if (_.isObject(data)) {
                data = Util.inspect(data, {showHidden: false, depth: null});
            }

            var logString = "";
            logString += new Date().toISOString() + ' ';
            logString += '[' + level + ']';
            logString += tag == "default" ? "" : ' [' + tag + ']';
            logString += !_.isString(message) ? "" : ': ' + message;
            logString += data ? ' --> ' + data : "";

            if (["error", "fatal"].indexOf(level) >= 0) {
                _outputLog("error", logString);
            } else if (level == "warn") {
                _outputLog("warn", logString);
            } else {
                _outputLog("info", logString);
            }
        }
    };

    /**
     * Writes log event to console
     * @param level
     * @param obj
     * @private
     */
    var _outputLog = function (level, message) {
        console[level](message);
    };

    /**
     * Provide log methods
     * @param obj
     * @param tag
     * @returns {*}
     */
    var createLogger = function (obj, tag) {
        tag = _.isArray(tag) ? tag.join(',') : tag;
        tag = !_.isEmpty(tag) ? tag.toLowerCase() : 'default';

        obj.trace = function (message, data) {
            _logEvent("trace", message, tag, data);
        };

        obj.debug = function (message, data) {
            _logEvent("debug", message, tag, data);
        };

        obj.info = function (message, data) {
            _logEvent("info", message, tag, data);
        };

        obj.warn = function (message, data) {
            _logEvent("warn", message, tag, data);
        };

        obj.error = function (message, data) {
            _logEvent("error", message, tag, data);
        };

        obj.fatal = function (message, data) {
            _logEvent("fatal", message, tag, data);
        };

        return obj;
    };

    createLogger(self);

    /**
     * Provide tag method with log methods
     * @param tag
     * @returns {*}
     */
    self.tag = function (tag) {
        tag = _.toArray(arguments);
        return createLogger({}, tag);
    };

    return self;
};

module.exports = thisModule();