/**
 * Collects debug data and returns and debug object
 * @returns {Function}
 */

var ErrorToPlainObject = require("./errorToPlainObject.js");
var IPAddressHelper = require('./ipAddressHelper.js');
var IP = require("ip");
var Shared;

module.exports = function (req, err) {
    if (!Shared) {
        Shared = require("./../../shared");
    }

    //Show debug infos in response if debug flat set in header and environment settings allow debug
    var debug = {};
    debug.request = {};

    // Custom debug data defined in controllers
    if (req.debug) {
        debug.request.debug = req.debug;
    }

    //Session data
    if (req.miajs && req.miajs.device) {
        debug.device = req.miajs.device;
    }

    //Query data
    if (req.query) {
        debug.request.query = req.query;
    }

    //Submitted body data
    if (req.body) {
        debug.request.body = req.body;
    }

    //Submitted headers
    if (req.headers) {
        debug.request.headers = req.headers;
    }

    //Request method
    if (req.method) {
        debug.request.method = req.method;
    }

    //Request url
    if (req.url) {
        debug.request.url = req.url;
    }

    debug.request.date = new Date(Date.now());

    debug.request.ip = IPAddressHelper.getClientIP(req);

    if (err) {
        debug.errors = ErrorToPlainObject(err);
    }

    // Show internal server ip
    var ipAddress = IP.address();
    if (ipAddress) {
        debug.server = {
            ip: ipAddress
        };
    }

    // Run environment run mode in debug infos
    var envMode = Shared.config("environment.mode");
    if (envMode) {
        debug.environment = {
            mode: envMode
        };
    }

    // Add route informations
    if (req.miajs && req.miajs.route) {
        if (req.miajs.route.group) {
            debug.request.group = req.miajs.route.group;
        }
        if (req.miajs.route.version) {
            debug.request.version = req.miajs.route.version;
        }
    }

    // Show controller infos i.e. runtime
    if (req.miajs && req.miajs.controllerDebugInfo) {
        debug.controller = req.miajs.controllerDebugInfo;
    }

    return debug;
};
