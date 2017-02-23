var Trycatch = require('trycatch')
    , BodyParser = require('body-parser')
    , ErrorHandler = require("./../../errorHandler")
    , Logger = require('./../../logger')
    , _ = require('lodash')
    , Shared = require('./../../shared')
    , IPAddressHelper = require('./../../utils').IPAddressHelper
    , Translator = require('./../../translator')
    , Utils = require('./../../utils')
    , RateLimiter = require('./../../rateLimiter')
    , MemberHelpers = Utils.MemberHelpers
    , fs = require('fs')
    , PreconditionsCheck = require('./preconditionsCheck')
    , ParameterPreloader = require('./parameterPreloader')
    , Swagger = require('./swaggerDocs')
    , Q = require('q');

Q.stopUnhandledRejectionTracking();

function thisModule() {

    var self = this;

    var _vhosts;

    var _registeredServices = function (hostId, routeConfig, methodValue, method, path) {

        var thisConfig = _.clone(routeConfig);
        var parameters = thisConfig.preconditions ? _parsePreConditionsParameters(thisConfig.preconditions) : null;
        var responses = _parseResponseCodes(thisConfig.preconditions);

        var name = !_.isEmpty(thisConfig.name) && _.isString(thisConfig.name) ? thisConfig.name : thisConfig.prefix;

        var methodParams = _convertMethod(method)
            , requestMethod = methodParams.requestMethod
            , serviceRegistered = false
            , serviceDetails = {
                hostId: hostId,
                name: name,
                group: thisConfig.group,
                version: thisConfig.version,
                modified: (methodValue.modified).toISOString(),
                requestMethod: requestMethod.toUpperCase(),
                url: path,
                prefix: thisConfig.prefix,
                deprecated: methodValue.deprecated === true,
                method: method,
                description: thisConfig.description || null,
                id: methodValue.identity,
                authorization: methodValue.authorization || methodValue.session || _.findIndex(methodValue.controller, {name: 'generic-validateSession'}) != -1,

                //Parameters for preconditioncheck
                preconditions: thisConfig.preconditions || null,
                responses: responses,
                responseSchemes: methodValue.responseSchemes,
                parameters: parameters || null,
                controllers: thisConfig.controllers,
                errorController: thisConfig.errorController,
                docs: thisConfig.docs || false
            };

        //unused at the moment
        //Check if name and path already exist. Add requestMethod if exist
//        _.forEach(Shared.registeredServices(), function (regService) {
//            if (regService.path == path && regService.name == methodValue.identity) {
//                //update registered service
//                (regService.requestMethods).push(requestMethod.toUpperCase());
//                if (new Date(regService.modified) <= new Date(methodValue.modified)) {
//                    regService.modified = (methodValue.modified).toISOString();
//                }
//                serviceRegistered = true;
//            }
//        });

        if (!serviceRegistered) {
            Shared.registerService(serviceDetails);
        }
    };

    // Returns a list of http codes defined in preconditions section in controller
    var _parseResponseCodes = function (preconditions) {
        var errorCodesList = {
            "500": ["InternalServerError"],
            "400": [
                "UnexpectedDefaultValue",
                "UnexpectedType",
                "MinLengthUnderachieved",
                "MaxLengthExceeded",
                "MinValueUnderachived",
                "MaxValueExceeded",
                "ValueNotAllowed",
                "PatternMismatch",
                "MissingRequiredParameter"],
            "429": ["RateLimitExceeded"],
        };
        for (var index in preconditions) {
            if (preconditions[index].conditions && preconditions[index].conditions.responses) {
                for (var code in preconditions[index].conditions.responses) {
                    if (errorCodesList[code]) {
                        if (_.isArray(preconditions[index].conditions.responses[code])) {
                            for (var ecode in preconditions[index].conditions.responses[code]) {
                                if (_.indexOf(errorCodesList[code], preconditions[index].conditions.responses[code][ecode]) == -1) {
                                    errorCodesList[code].push(preconditions[index].conditions.responses[code][ecode]);
                                }
                            }
                        }
                        else {
                            if (_.indexOf(errorCodesList[code], preconditions[index].conditions.responses[code]) == -1) {
                                errorCodesList[code].push(preconditions[index].conditions.responses[code]);
                            }
                        }
                    }
                    else {
                        if (_.isArray(preconditions[index].conditions.responses[code])) {
                            errorCodesList[code] = _.clone(preconditions[index].conditions.responses[code]);
                        }
                        else {
                            errorCodesList[code] = [_.clone(preconditions[index].conditions.responses[code])];
                        }
                    }
                }
            }
        }
        return errorCodesList;
    };

    var _parsePreConditionsParameters = function (preconditions) {

        var allowedAttributes = ["type", "desc", "subType", "required", "maxLength", "minLength", "match", "max", "min", "allow", "deny"];

        var parametersList = {};

        var _functionName = function (fun) {
            var ret = fun.toString();
            ret = ret.substr('function '.length);
            ret = ret.substr(0, ret.indexOf('('));
            return ret;
        };

        // Remove attributes recursivly
        var _removeAttributes = function (attr, attrName) {
            if (_.isObject(attr) && !_.isDate(attr) && !_.isBoolean(attr) && !_.isString(attr) && !_.isNumber(attr) && !_.isFunction(attr) && !_.isRegExp(attr) && !_.isArray(attr)) {
                //attr = _removeAttributes();
                for (var aIndex in attr) {
                    attr[aIndex] = _removeAttributes(attr[aIndex], aIndex);
                }
                return attr;
            }
            else {
                if (_.indexOf(allowedAttributes, attrName) != -1) {
                    if (_.isFunction(attr)) {
                        attr = _functionName(attr);
                    }

                    return attr;
                }
                else {
                    return;
                }
            }
        };

        // Parse preconditions parameters in section header, query, body
        var _parseSection = function (parametersList, parameters, section) {
            if (parameters[section]) {
                for (var name in parameters[section]) {
                    var addCondition = parameters[section][name];
                    if (parametersList[section] && parametersList[section][name]) {

                        // Merge parameters attributes
                        for (var attr in addCondition) {
                            if (!parametersList[section][name][attr]) {
                                // Attribute does not exists -> add to list
                                parametersList[section][name][attr] = addCondition[attr];
                            }
                            else {
                                // Attribute already exists compare values
                                if (_.isFunction(addCondition[attr])) {
                                    addCondition[attr] = _functionName(addCondition[attr]);
                                }

                                if (JSON.stringify(parametersList[section][name][attr]) != JSON.stringify(addCondition[attr])) {
                                    throw new Error("Precondition conflict: " + preconditions[index].name + ' -> ' + preconditions[index].version + ' -> ' + preconditions[index].method + ' -> ' + attr + ':' + addCondition[attr] + ' ->  already defined in previous controller and value is mismatching');
                                }
                                else {
                                    parametersList[section][name][attr] = addCondition[attr];
                                }
                            }
                        }
                    }
                    else {
                        parametersList[section] = parametersList[section] ? parametersList[section] : {};
                        parametersList[section][name] = addCondition;
                    }

                    // Filter parameter attributes by allowedAttributes
                    var validatedParameterAttributes = {};
                    if (parametersList[section] && parametersList[section][name]) {
                        for (var attr in parametersList[section][name]) {
                            validatedParameterAttributes[attr] = _removeAttributes(parametersList[section][name][attr], attr);
                        }
                    }

                    if (!_.isEmpty(validatedParameterAttributes)) {
                        parametersList[section][name] = validatedParameterAttributes;
                    }
                }
            }
            return parametersList;
        };

        for (var index in preconditions) {
            if (preconditions[index].conditions && preconditions[index].conditions.parameters) {
                parametersList = _parseSection(parametersList, preconditions[index].conditions.parameters, "header");
                parametersList = _parseSection(parametersList, preconditions[index].conditions.parameters, "query");
                parametersList = _parseSection(parametersList, preconditions[index].conditions.parameters, "body");
                parametersList = _parseSection(parametersList, preconditions[index].conditions.parameters, "path");
            }
        }
        return parametersList;
    };


    var _isDuplicateRoute = function (path, requestMethod) {
        var set = false
        _.forEach(Shared.registeredServices(), function (regService) {
            if (regService.requestMethod) {
                if (regService.path == path && regService.requestMethod == requestMethod.toUpperCase()) {
                    set = true;
                }
            }
        });
        return set;
    };

    var _isDuplicateIdentity = function (hostId, prefix, id) {
        var set = false
        _.forEach(Shared.registeredServices(), function (regService) {
            if (regService.id) {
                if (regService.hostId == hostId && regService.prefix == prefix && regService.id == id) {
                    set = true;
                }
            }
        });
        return set;
    };

    var _convertMethod = function (method) {

        var requestMethod
            , extension;

        switch (method) {
            //low-level methods keywords
            case 'get':
                requestMethod = 'get';
                extension = '';
                break;
            case 'put':
                requestMethod = 'put';
                extension = '';
                break;
            case 'post':
                requestMethod = 'post';
                extension = '';
                break;
            case 'del':
                requestMethod = 'delete';
                extension = '';
                break;
            //logical RESTful method keywords
            case 'list':
                requestMethod = 'get';
                extension = '';
                break;
            case 'index':
                requestMethod = 'get';
                extension = '/:id';
                break;
            case 'create':
                requestMethod = 'post';
                extension = '';
                break;
            case 'update':
                requestMethod = 'put';
                extension = '/:id';
                break;
            case 'delete':
                requestMethod = 'delete';
                extension = '/:id';
                break;
            default:
                return false;
        }

        return {requestMethod: requestMethod, extension: extension};
    };

    var _getMethodFunction = function (controller, version, method) {
        var currentController = Shared.controllers([controller, version]);

        if (currentController) {
            if (currentController[method] && _.isFunction(currentController[method])) {
                return {function: currentController[method], method: method};
            }
            else if (_.isFunction(currentController['all'])) {
                return {function: currentController['all'], method: "all"};
            }
            else {
                throw new Error(controller + ' ' + version + '->' + method + ' does not exists but used in routes configuration');
            }

        }

    };

    var _getFunctionConfig = function (controller, version, parameter) {
        var currentController = Shared.controllers([controller, version]);

        if (currentController) {
            if (currentController[parameter]) {
                return currentController[parameter];
            }
        }
    };

    var _registerRoute = function (hostId, routeConfig, requestMethod, method, path, methodFunction, controller) {
        var thisConfig = _.clone(routeConfig);

        var routeFunctions = [];

        var innerRequestFunction = function (req, res, next) {

            if (!req.miajs) {
                req.miajs = {};
            }
            // Add route informations to req
            req.miajs.route = {
                hostId: hostId,
                group: (thisConfig.group),
                version: thisConfig.version,
                prefix: thisConfig.prefix,
                url: path,
                requestmethod: requestMethod,
                deprecated: thisConfig.deprecated === true,
                method: method,
                rateLimits: thisConfig.rateLimits || null
            };

            // Check if culture.code header is set and force this cultureCode
            if (req && req.header && req.header('culture.code') && (/[a-zA-Z]{2}-[a-zA-Z]{2}/i).test(req.header('culture.code'))) {
                MemberHelpers.setPathPropertyValue(req, 'miajs.device.culture.language', (req.header('culture.code')).substr(0, 2));
                MemberHelpers.setPathPropertyValue(req, 'miajs.device.culture.region', (req.header('culture.code')).substr(3, 2));
            }
            else {
                if (!MemberHelpers.getPathPropertyValue(req, 'miajs.device.culture.language')) {
                    MemberHelpers.setPathPropertyValue(req, 'miajs.device.culture.language', Shared.config('system.defaultCulture.language'));
                }
                if (!MemberHelpers.getPathPropertyValue(req, 'miajs.device.culture.region')) {
                    MemberHelpers.setPathPropertyValue(req, 'miajs.device.culture.region', Shared.config('system.defaultCulture.region'));
                }
            }

            req.miajs.translator = function (group, key, replacements) {
                return Translator(group, key, req.miajs.device.culture.language, req.miajs.device.culture.region, replacements);
            };

            req.miajs.controllerStart = Date.now();
            methodFunction(req, res, next);
        };

        // Measure runtime of controller
        var runtimeMeasure = function (req, res, next) {
            if (!req.miajs.controllerDebugInfo) {
                req.miajs.controllerDebugInfo = {};
            }
            if (controller.name && controller.version) {
                req.miajs.controllerDebugInfo[controller.name + '_' + controller.version] = {'runtime': Date.now() - req.miajs.controllerStart};
            }
            next();
        };

        //Wrap each request function in a try catch block to catch all application exceptions automatically
        //This is not recommended for production mode, that's why it is possible to turn this feature on/off from the config for each environment (local, stage, production) separately.
        //But in worst case with the feature turned off, if some exception is not handled the server might go down.
        var requestFunction;
        var env = Shared.config("environment");
        if (env.tryCatchForRouteFunctions) {
            requestFunction = function (req, res, next) {
                Trycatch(function () {
                    innerRequestFunction(req, res, next);
                }, function (err) {
                    Logger.error(err);
                    next({'status': 500, name: 'ApplicationException', raw: err}, req, res);
                });
            }
        }
        else {
            requestFunction = innerRequestFunction;
        }

        // If no bodyParser is specified in project assume 'json' as default body parser.
        // If bodyParser needs to be disabled, it must be explicitly set to 'none' in routes
        var bodyParser = _getBodyParser(thisConfig.bodyParser);
        //register the request function
        if (bodyParser) {
            routeFunctions.push(bodyParser);
            routeFunctions.push(requestFunction);
        }
        else {
            routeFunctions.push(requestFunction);
        }

        //register runtime measure function after each controller
        routeFunctions.push(runtimeMeasure);

        return routeFunctions;
    };

    var rawBodySaver = function (req, res, buf, encoding) {
        if (buf && buf.length) {
            req.rawBody = buf.toString(encoding || 'utf8');
        }
    };

    var _getBodyParser = function (bodyParserConfig) {
        bodyParserConfig = bodyParserConfig || {};
        var type = bodyParserConfig.type || 'json';
        var limit = bodyParserConfig.limit || '512kb';
        switch (type) {
            case 'none':
                return undefined;
            case 'json':
                return BodyParser.json({
                    limit: limit,
                    verify: function (req, res, buf, encoding) {
                        req.rawBodyJSON = buf.toString();
                    }
                });
            case 'raw':
                return BodyParser.raw({ verify: rawBodySaver, type: '*/*' });
            case 'text':
                return BodyParser.text();
            case 'urlencoded':
                return BodyParser.urlencoded({extended: true});
        }
    };

    //Validate rate limits settings
    var _validateRateLimits = function (routeConfig, methodValue) {
        var rateLimits = [];
        var environment = Shared.config("environment");
        var globalRateLimit = environment.rateLimit;
        if (globalRateLimit) {
            if (globalRateLimit.interval && _.isNumber(globalRateLimit.interval) && parseInt(globalRateLimit.interval) > 0 && globalRateLimit.maxRequests && _.isNumber(globalRateLimit.maxRequests) && parseInt(globalRateLimit.maxRequests) > 0) {
                rateLimits.push(globalRateLimit);
            }
            else {
                throw new Error('Global rate limit config invalid'+". Provide parameters 'interval' and 'maxRequests' with Int value");
            }
        }
        if (routeConfig && routeConfig.rateLimit) {
            if (routeConfig.rateLimit.interval && _.isNumber(routeConfig.rateLimit.interval) && parseInt(routeConfig.rateLimit.interval) > 0 && routeConfig.rateLimit.maxRequests && _.isNumber(routeConfig.rateLimit.maxRequests) && parseInt(routeConfig.rateLimit.maxRequests) > 0) {
                rateLimits.push(routeConfig.rateLimit);
            }
            else {
                throw new Error('Rate limit config invalid for route file ' + routeConfig.prefix+". Provide parameters 'interval' and 'maxRequests' with Int value");
            }
        }
        if (methodValue && methodValue.rateLimit) {
            if (methodValue.rateLimit.interval && _.isNumber(methodValue.rateLimit.interval) && parseInt(methodValue.rateLimit.interval) > 0 && methodValue.rateLimit.maxRequests && _.isNumber(methodValue.rateLimit.maxRequests) && parseInt(methodValue.rateLimit.maxRequests) > 0) {
                rateLimits.push(methodValue.rateLimit);
            }
            else {
                throw new Error('Rate limit config invalid for route ' + methodValue.identity + ' in route file ' + routeConfig.prefix+". Provide parameters 'interval' and 'maxRequests' with Int value");
            }
        }

        if (!_.isEmpty(rateLimits) && !Shared.memcached()){
            throw new Error("Rate limits set but memcached not configured. Provide settings for memcached in environment config file");
        }

        return rateLimits;
    };


    // Route for rate limits check
    var _rateLimitRoute = function (req, res, next) {
        var ip = IPAddressHelper.getClientIP(req)
            , route = req.miajs.route
            , key = ip + route.path + route.method;

        if (_.isEmpty(route.rateLimits)) {
            next();
            return;
        }

        RateLimiter.checkRateLimitsByKey(key, route.rateLimits).then(function (rateLimiterResult) {
            if (rateLimiterResult.remaining == -1) {
                Logger.info("Rate limit of " + rateLimiterResult.limit + "req/" + rateLimiterResult.timeInterval + "min requests exceeded " + route.requestmethod.toUpperCase() + " " + route.url + " for " + ip);
                res.header("X-Rate-Limit-Limit", rateLimiterResult.limit);
                res.header("X-Rate-Limit-Remaining", 0);
                res.header("X-Rate-Limit-Reset", rateLimiterResult.timeTillReset);
                next({
                    status: 429,
                    err: {
                        'code': 'RateLimitExceeded',
                        'msg': Translator('system', 'RateLimitExceeded')
                    }
                });
            }
            else {
                res.header("X-Rate-Limit-Limit", rateLimiterResult.limit);
                res.header("X-Rate-Limit-Remaining", rateLimiterResult.remaining);
                res.header("X-Rate-Limit-Reset", rateLimiterResult.timeTillReset);
                next();
            }
        }).fail(function () {
            next();
        }).done();
    };

    var _parseMethods = function (hostId, routeConfig, path, methods) {
        var prefix = routeConfig.prefix
            , corsHeadersGlobal = routeConfig.corsHeaders
            , deprecatedGlobal = routeConfig.deprecated
            , thisPath
            , requestMethod
            , methodFunction
            , methodPathExtension
            , methodParams
            , thisRouteConfig = _.clone(routeConfig);

        _.forEach(methods, function (methodValue, method) {
            methodParams = _convertMethod(method);
            requestMethod = methodParams.requestMethod;
            methodPathExtension = methodParams.extension;
            if (!prefix || prefix == "/") {
                prefix = '';
            }

            if (!_.isArray(prefix)) {
                prefix = [prefix];
            }

            thisRouteConfig.preconditions = [];

            // Add Prefix
            _.forEach(prefix, function (thisPrefix) {
                thisRouteConfig.prefix = thisPrefix;

                // Set
                if (path.substr(0, 1) == '.') {
                    thisPath = thisPrefix + path.substr(1, path.length) + methodPathExtension;
                }
                else {
                    thisPath = path + methodPathExtension;
                }

                var globalPath = _vhosts[hostId]["host"] == "*" ? "*" + thisPath : _vhosts[hostId]["host"] + thisPath;

                //Add pluralisation for method list
                /*if (method == 'list') {
                 thisPath = thisPath + 's';
                 }*/

                if (_isDuplicateIdentity(hostId, prefix, methodValue.identity)) {
                    throw new Error(methodValue.identity + ' for ' + prefix + ' ->  already registerd');
                }
                else {
                    if (!_isDuplicateRoute(thisPath, requestMethod)) {

                        var routeFunctions = [];

                        Logger.info(requestMethod.toUpperCase() + ' ' + globalPath);

                        thisRouteConfig.rateLimits = _validateRateLimits(routeConfig, methodValue);
                        thisRouteConfig.bodyParser = methodValue["bodyParser"] || thisRouteConfig.bodyParser;
                        routeFunctions = routeFunctions.concat(_registerRoute(hostId, thisRouteConfig, requestMethod, method, thisPath, _rateLimitRoute, {
                            name: 'rateLimiter',
                            version: '1.0'
                        }));

                        // Register precondition controller
                        routeFunctions = routeFunctions.concat(_registerRoute(hostId, thisRouteConfig, requestMethod, method, thisPath, PreconditionsCheck, {
                            name: 'preconditionsCheck',
                            version: '1.0'
                        }));
                        Logger.info('-> PreconditionsCheck');

                        //Register all controller for this method
                        _.forEach(methodValue.controller, function (controller) {

                            if (methodValue.description) {
                                thisRouteConfig.description = methodValue.description;
                            }

                            //if controller.function is set, bind to this function, otherwise use default mapping
                            var methodFunctionName;
                            if (controller.function) {
                                methodFunctionName = controller.function;
                            }
                            else {
                                methodFunctionName = method;
                            }

                            // Convert method to requestMethod
                            methodFunction = _getMethodFunction(controller.name, controller.version, methodFunctionName);

                            if (_.isUndefined(methodFunction)) {
                                throw new Error('Controller ' + controller.name + ' ' + controller.version + '->' + methodFunctionName + ' does not exists');
                            }

                            if (methodFunction.function) {
                                var controllerPreconditions = _getFunctionConfig(controller.name, controller.version, "preconditions");

                                if (controllerPreconditions && (controllerPreconditions[methodFunction.method])) {
                                    thisRouteConfig.preconditions = thisRouteConfig.preconditions ? thisRouteConfig.preconditions : [];

                                    var precondition = {
                                        name: controller.name,
                                        version: controller.version,
                                        function: controller.function,
                                        method: methodFunction.method,
                                        conditions: controllerPreconditions[methodFunction.method]
                                    };

                                    if (controllerPreconditions[methodFunction.method].parameters && !controllerPreconditions[methodFunction.method].responses) {
                                        throw new Error('Precondition parameters defined in ' + controller.name + ' ' + controller.version + '->' + methodFunction.method + ' but no responses defined');
                                    }

                                    thisRouteConfig.preconditions.push(precondition);
                                }

                                // Preload validated parameters for next controller
                                routeFunctions = routeFunctions.concat(_registerRoute(hostId, thisRouteConfig, requestMethod, method, thisPath, ParameterPreloader, {
                                    name: 'parameterPreloader',
                                    version: '1.0'
                                }));
                                //Logger.info(requestMethod.toUpperCase() + ' ' + thisPath + '-> ParameterPreloader');

                                //Register route
                                routeFunctions = routeFunctions.concat(_registerRoute(hostId, thisRouteConfig, requestMethod, method, thisPath, methodFunction.function, controller));
                                Logger.info('-> ' + controller.name + ' ' + controller.version + '::' + methodFunctionName);
                            }
                            else {
                                Logger.error('-> ' + controller.name + ' ' + controller.version + '::' + methodFunctionName + '<-- NOT FOUND');
                                throw new Error("Missing controller file!");
                            }
                        });
                        thisRouteConfig.docs = methodValue.docs;
                        thisRouteConfig.controllers = methodValue.controller;
                        thisRouteConfig.errorController = methodValue.errorController;

                        methodValue.deprecated = methodValue.deprecated || deprecatedGlobal;

                        if (methodValue.environment) {
                            if (!_.isArray(methodValue.environment)) {
                                methodValue.environment = [methodValue.environment];
                            }

                            if (_.indexOf(methodValue.environment, Shared.config("environment.mode")) != -1) {
                                _registeredServices(hostId, thisRouteConfig, methodValue, method, thisPath);
                            }
                        }
                        else {
                            _registeredServices(hostId, thisRouteConfig, methodValue, method, thisPath);
                        }


                        var corsHeaders = methodValue.corsHeaders || corsHeadersGlobal;

                        var setCrossDomainHeaders = function (req, res, next) {

                            //Set cors header fields
                            for (var corsHeader in corsHeaders) {
                                if (_.isString(corsHeader) && ((!_.isEmpty(corsHeaders[corsHeader]) && _.isString(corsHeader)) || _.isBoolean(corsHeaders[corsHeader]))) {
                                    res.setHeader(corsHeader, corsHeaders[corsHeader]);
                                }
                            }

                            res.setHeader("Access-Control-Allow-Methods", requestMethod.toUpperCase() + ", OPTIONS");

                            // Auto add allow method for route
                            if (req.method == 'OPTIONS') {
                                res.send(204);
                            }
                            else {
                                res.setHeader("Access-Control-Allow-Methods", requestMethod.toUpperCase());
                                next();
                            }

                        };

                        // Add CORS header support
                        if (!_.isEmpty(corsHeaders)) {
                            Logger.info('Added CORS headers to route');
                            _vhosts[hostId]["express"]["options"].apply(_vhosts[hostId]["express"], [thisPath].concat(setCrossDomainHeaders));
                            routeFunctions = [setCrossDomainHeaders].concat(routeFunctions);
                        }

                        // Apply route and register all nested controller functions
                        var routeArguments = [thisPath].concat(routeFunctions);
                        _vhosts[hostId]["express"][requestMethod].apply(_vhosts[hostId]["express"], routeArguments);
                        Logger.info('------------------------------------------------------------------------------------');
                    }
                    else {
                        throw new Error(requestMethod.toUpperCase() + ' ' + thisPath + '->' + methodValue.identity + ' already registerd');
                    }


                }
            });
        });
    };


    var _parseRoutes = function (routeConfig) {
        var routes = routeConfig.routes;
        var hostIds = routeConfig.hostId;
        if (_.isEmpty(hostIds)) {
            hostIds = ["*"];
        }
        if (_.isString(hostIds)) {
            hostIds = [hostIds];
        }

        if (!_.isArray(hostIds)) {
            throw new Error('Unknown definition type for host used in routes definiton. Use string or array');
        }

        for (var i in hostIds) {
            var hostId = hostIds[i];
            if (hostId != "*") {
                if (_.isEmpty(_vhosts[hostId])) {
                    throw new Error('Host ' + hostId + ' for route ' + routeConfig.group + ' not registered in mia.js global configuration.');
                }
            }

            if (routes) {
                if (_.isArray(routes) == false) {
                    routes = [routes];
                }

                //Register assets directory
                if (_.isArray(routeConfig.prefix) == false) {
                    routeConfig.prefix = [routeConfig.prefix];
                }
                _.forEach(routeConfig.prefix, function (thisPrefix) {
                    assetsDir = routeConfig.projectDir + '/' + Shared.config("system.path.modules.public");
                    if (fs.existsSync(assetsDir)) {

                        if (thisPrefix == "/") {
                            _vhosts[hostId]["express"].use(Shared.express().static(assetsDir));
                        }
                        else {
                            _vhosts[hostId]["express"].use(thisPrefix + '/', Shared.express().static(assetsDir));
                        }
                        Logger.info('ASSETS ' + thisPrefix + '/->' + assetsDir);
                    }
                });

                _.forEach(routes, function (route) {
                    if (_.isObject(route)) {
                        _.forEach(route, function (methods, path) {
                            _parseMethods(hostId, routeConfig, path, methods);
                        });
                    }
                });

                // Check if not empty or root
                if (!routeConfig.prefix || routeConfig.prefix == "/") {
                    routeConfig.prefix = '';
                }


            }
            else {
                Logger.error('ERROR No routes found');
            }
        }
    };

    var _parseRouteConfig = function () {
        _.forEach(Shared.routesConfig(), function (routeConfig, key) {
                if (!routeConfig.group) {
                    Logger.error('Missing group field for routes file');
                }

                if (!routeConfig.version) {
                    Logger.error('Missing version field for routes file');
                }

                if (routeConfig.routes) {

                    // Check if route should be activeted for current environment
                    if (routeConfig.environment) {
                        if (!_.isArray(routeConfig.environment)) {
                            routeConfig.environment = [routeConfig.environment];
                        }

                        if (_.indexOf(routeConfig.environment, Shared.config("environment.mode")) != -1) {
                            Logger.info('Creating routes for ' + routeConfig.group + ', Version: ' + routeConfig.version);
                            _parseRoutes(routeConfig);
                        }
                        else {
                            Logger.info('Ignore routes for ' + routeConfig.group + ', Version: ' + routeConfig.version + ' due to route is not allowed for current environment mode (' + Shared.config("environment.mode") + ')');
                        }
                    }
                    else {
                        Logger.info('Creating routes for ' + routeConfig.group + ', Version: ' + routeConfig.version);
                        _parseRoutes(routeConfig);
                    }
                }
            }
        );
    };

    var _defaultErrorHandling = function (err, req, res, next) {
        // Check if culture.code header is set and force this cultureCode
        if (req && req.header && req.header('culture.code') && (/[a-zA-Z]{2}-[a-zA-Z]{2}/i).test(req.header('culture.code'))) {
            MemberHelpers.setPathPropertyValue(req, 'miajs.device.culture.language', (req.header('culture.code')).substr(0, 2));
            MemberHelpers.setPathPropertyValue(req, 'miajs.device.culture.region', (req.header('culture.code')).substr(3, 2));
        }
        else {
            if (!MemberHelpers.getPathPropertyValue(req, 'miajs.device.culture.language')) {
                MemberHelpers.setPathPropertyValue(req, 'miajs.device.culture.language', Shared.config('system.defaultCulture.language'));
            }
            if (!MemberHelpers.getPathPropertyValue(req, 'miajs.device.culture.region')) {
                MemberHelpers.setPathPropertyValue(req, 'miajs.device.culture.region', Shared.config('system.defaultCulture.region'));
            }
        }

        req.miajs.translator = function (group, key, replacements) {
            return Translator(group, key, req.miajs.device.culture.language, req.miajs.device.culture.region, replacements);
        };

        var genericErrorController = Shared.controllers('generic-defaultJSONErrorResponse', "1.0");
        if (genericErrorController && genericErrorController.errorOutput && _.isFunction(genericErrorController.all)) {
            Shared.controllers('generic-defaultJSONErrorResponse', "1.0").all(err, req, res);
        }
        else {
            ErrorHandler.output(err, req, res);
        }
    };

    self.initializeRoutes = function (vhosts) {

        _vhosts = vhosts;
        //parse route config
        _parseRouteConfig();

        Swagger.register(_vhosts);

        for (var thisVhost in _vhosts) {

            //Send 404 if no controller found
            _vhosts[thisVhost]["express"].use(function (req, res, next) {
                next({'status': 404}, req, res);
            });

            // Define global error handler
            _vhosts[thisVhost]["express"].use(function (err, req, res, next) {

                //Define default error handler
                var lastHandler = function () {
                    return _defaultErrorHandling(err, req, res, next);
                };

                //Lookup for custom error handler controller and call custom error controllers per route
                if (req.miajs && req.miajs.route) {
                    var hostId = req.miajs.route.hostId;
                    var url = req.miajs.route.url;
                    var prefix = req.miajs.route.prefix;
                    var method = req.miajs.route.method;
                    var group = req.miajs.route.group;
                    var version = req.miajs.route.version;
                    var registeredServices = Shared.registeredServices();

                    for (var index in registeredServices) {
                        if (registeredServices[index].group == group
                            && registeredServices[index].hostId == hostId
                            && registeredServices[index].version == version
                            && registeredServices[index].prefix == prefix
                            && registeredServices[index].method == method
                            && registeredServices[index].url == url) {

                            if (!_.isEmpty(registeredServices[index]["errorController"]) && _.isArray(registeredServices[index]["errorController"])) {
                                var errorControllers = registeredServices[index]["errorController"];

                                // Chain custom error handler controllers
                                for (var j = errorControllers.length - 1; j >= 0; --j) {
                                    lastHandler = (function (lastHandler, j, index, errorControllers) {
                                        return function () {
                                            var thisArg = Shared.controllers([errorControllers[j]["name"], errorControllers[j]["version"]]);
                                            var methodFunctionName = errorControllers[j].function || method;
                                            var methodFunction = _getMethodFunction(errorControllers[j]["name"], errorControllers[j]["version"], methodFunctionName);
                                            methodFunction.function.call(thisArg, err, req, res, lastHandler);
                                        };
                                    })(lastHandler, j, index, errorControllers);
                                }
                            }
                        }
                    }
                }

                //Call error handler function
                lastHandler();
            });
        }
        //console.log(Shared.registeredServices());
        return _vhosts;
    };
    return self;
};

module.exports = new thisModule();
