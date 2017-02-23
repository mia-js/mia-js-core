var Shared = require('./../../shared')
    , Q = require('q')
    , _ = require("lodash");

Q.stopUnhandledRejectionTracking();

function ThisModule() {

    /**
     * Preloads validated parameters (header,query,body,path) that are validated in preconditionsCheck into variable req.miajs.validatedParameters
     * Variable validatedParameters will be overwritten by next controller preload, so only those parameters are available that are defined in parameters section of the current controller
     * @param req
     * @param res
     * @param next
     */
    var parameterPreloader = function (req, res, next) {
        var hostId = req.miajs.route.hostId;
        var url = req.miajs.route.url;
        var prefix = req.miajs.route.prefix;
        var method = req.miajs.route.method;
        var group = req.miajs.route.group;
        var version = req.miajs.route.version;
        var registeredServices = Shared.registeredServices();
        var nextControllerIndex;

        req.miajs = req.miajs || {};

        //console.log('checkPreconditions: url: ' + url + ', method: ' + method + ', body: ' + JSON.stringify(req.body));

        for (var index in registeredServices) {
            if (registeredServices[index].group == group
                && registeredServices[index].hostId == hostId
                && registeredServices[index].version == version
                && registeredServices[index].prefix == prefix
                && registeredServices[index].method == method
                && registeredServices[index].url == url
                && registeredServices[index].preconditions) {
                var service = registeredServices[index];

                if (!req.miajs) {
                    req.miajs = {};
                }

                var nextController = req.miajs.nextController || service.controllers[0];

                for (var cIndex in service.controllers) {
                    if (service.controllers[cIndex].name == nextController.name
                        && service.controllers[cIndex].version == nextController.version
                        && service.controllers[cIndex].function == nextController.function) {
                        nextControllerIndex = cIndex;
                    }
                }

                if (nextControllerIndex) {
                    req.miajs.validatedParameters = undefined;
                    // Search for validated data in registeredServices
                    if (req.miajs.commonValidatedParameters && nextController) {
                        for (var dIndex in req.miajs.commonValidatedParameters) {
                            var paramEntry = req.miajs.commonValidatedParameters[dIndex];
                            if (paramEntry.name == nextController.name
                                && paramEntry.version == nextController.version
                                && paramEntry.function == nextController.function) {
                                req.miajs.validatedParameters = paramEntry.data;
                            }
                        }
                    }

                    if (service.controllers[parseInt(nextControllerIndex) + 1]) {
                        req.miajs.nextController = service.controllers[parseInt(nextControllerIndex) + 1];
                    }
                    else {
                        req.miajs.nextController = undefined;
                    }
                }
                next();
                return;
            }
        }
        next();
        return;
    };

    return parameterPreloader;
};

module.exports = new ThisModule();