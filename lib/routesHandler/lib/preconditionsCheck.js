var Shared = require('./../../shared')
    , Q = require('q')
    , _ = require("lodash")
    , ModelValidator = require("./../../modelValidator")
    , Logger = require("./../../logger");

Q.stopUnhandledRejectionTracking();

/**
 * Preconditions can be defined in header of each controller. All parameters (header,query,path,body) defined will be validated and will be available in each controller
 * using the variable req.miajs.validatedData.
 * PreconditionsCheck only check if parameters are valid. If parameters are not valid qualified error messages returned
 *
 * preconditions definition example: (put this in head of controller definitions
 *
 * self.preconditions = {
            create: {
                responses: {
                    400: "BodyDataIsEmpty"
                }
            },
            update: {
                parameters: {
                    path: {
                        id: {
                            desc: "Device Id",
                            type: String,
                            minLength: 64,
                            maxLength: 64,
                            required: true
                        }
                    },
                    body: {
                        name: {
                            desc: "Name of user",
                            type: String,
                            minLength: 2,
                            maxLength: 64,
                            required: true
                        },
                        street: {
                            desc: "Street",
                            type: String,
                        }
                    }
                    query: {
                        limit: {
                            desc: "Limit of results",
                            type: Number,
                            min: 1,
                            max: 64,
                        }
                    },
                    header: {
                        key: {
                            desc: "ApiKey",
                            type: String,
                            minLength: 20,
                            maxLength: 20,
                            required: true
                        }
                    },
                },
                responses: {
                    400: ["BodyDataIsEmpty","DeviceIdDoesNotExist"],
                    403: "Forbidden"
                }
            }
        };
 */

function ThisModule() {

    /**
     * Validate given values using given model
     * @param values
     * @param model
     * @param type
     * @returns {*}
     * @private
     */
    var _checkValues = function (values, model, type) {
        var deferred = Q.defer();
        var modelData = {data: model};

        ModelValidator.validate(values, modelData, function (err, data) {
            deferred.resolve({data: data, err: err, type: type});
        });
        return deferred.promise;
    };

    /**
     * Parse parameter model of controller and validate all request parameters for header,query and body
     * @param req
     * @param controller
     * @returns {*}
     * @private
     */
    var _checkControllerConditions = function (req, controller) {
        var parameters = [];
        if (controller.conditions && controller.conditions.parameters && controller.conditions.parameters.header) {
            parameters.push(_checkValues(req.headers, controller.conditions.parameters.header, "header"))
        }

        if (controller.conditions && controller.conditions.parameters && controller.conditions.parameters.query) {
            parameters.push(_checkValues(req.query, controller.conditions.parameters.query, "query"))
        }

        if (controller.conditions && controller.conditions.parameters && controller.conditions.parameters.body) {
            parameters.push(_checkValues(req.body, controller.conditions.parameters.body, "body"))
        }

        if (controller.conditions && controller.conditions.parameters && controller.conditions.parameters.path) {
            parameters.push(_checkValues(req.params, controller.conditions.parameters.path, "path"))
        }

        return Q.all(parameters).then(function (results) {
            var validatedData = [];
            var errors = [];
            results.forEach(function (result) {
                if (result.data) {
                    if (!validatedData[result.type]) {
                        validatedData[result.type] = {};
                    }
                    validatedData[result.type] = result.data;
                }

                // Collect validation errors
                if (result.err && result.err.err && result.err.name == "ValidationError") {
                    var resultErrors = result.err.err;
                    resultErrors.forEach(function (error) {
                        error.in = result.type;
                        errors.push(error);
                    });
                }
            });

            return Q({
                validatedData: {
                    name: controller.name,
                    version: controller.version,
                    method: controller.method,
                    function: controller.function,
                    data: validatedData
                },
                errors: errors
            });
        });
    };

    /**
     * Apply all preconditions defined in all controllers of this route.
     * Try to find preconditions in registeredServices matching url, prefix, method, group and version
     * @param req
     * @param res
     * @param next
     */
    var checkPreconditions = function (req, res, next) {
        var hostId = req.miajs.route.hostId;
        var url = req.miajs.route.url;
        var prefix = req.miajs.route.prefix;
        var method = req.miajs.route.method;
        var group = req.miajs.route.group;
        var version = req.miajs.route.version;
        var registeredServices = Shared.registeredServices();
        var errors = [];
        var routeFound = false;
        req.miajs = req.miajs || {};

        //console.log('checkPreconditions: url: ' + url + ', method: ' + method + ', body: ' + JSON.stringify(req.body));

        for (var index in registeredServices) {

            if (registeredServices[index].group == group
                && registeredServices[index].hostId == hostId
                && registeredServices[index].version == version
                && registeredServices[index].prefix == prefix
                && registeredServices[index].method == method
                && registeredServices[index].url == url
            ) {
                routeFound = true;
                if (registeredServices[index].preconditions) {
                    var service = registeredServices[index];
                    var preconditionsList = service.preconditions;
                    var qfunctions = [];

                    for (var cIndex in preconditionsList) {
                        qfunctions.push(_checkControllerConditions(req, preconditionsList[cIndex]));
                    }

                    Q.all(qfunctions).then(function (results) {

                        req.miajs.commonValidatedParameters = [];

                        results.forEach(function (result) {
                            if (result) {
                                if (result.validatedData) {
                                    req.miajs.commonValidatedParameters.push(result.validatedData);
                                }

                                var controllerErrors = result.errors;
                                controllerErrors.forEach(function (error) {

                                    var inList = false;
                                    // Check for error duplicates
                                    for (var eIndex in errors) {
                                        if (errors[eIndex].code == error.code && errors[eIndex].id == error.id && errors[eIndex].in == error.in) {
                                            inList = true;
                                        }
                                    }

                                    if (inList == false) {
                                        errors.push(error);
                                    }
                                });
                            }
                        });

                    }).then(function () {
                        if (!_.isEmpty(errors)) {
                            next({'status': 400, err: errors})
                            return;
                        }
                        else {
                            next();
                            return;
                        }
                    }).fail(function (err) {
                        next({'status': 400, err: err});
                        return;
                    }).done();
                }
                else {
                    next();
                    return;
                }
            }
        }

        if (routeFound == false) {
            Logger.error('Can not find controller file in preconditionsCheck to perform parameter validation. Request canceled due to security reasons');
            next({status: 500});
            return;
        }
    };

    return checkPreconditions;
};

module.exports = new ThisModule();