var Shared = require('./../../shared')
    , SwaggerTools = require('swagger-tools')
    , _ = require('lodash')
    , ObjectHash = require('object-hash');

function thisModule() {
    var self = this;

    /**
     * Create swagger compatible schema for body parameters
     * @param bodySchemaModels
     * @param obj
     * @param defName
     * @returns {{bodySchemaModels: *, attributes: {}}}
     * @private
     */

    var _findDefSchema = function (bodySchemaModels, defName) {
        for (var i in bodySchemaModels) {
            if (bodySchemaModels[i]["name"] == defName) {
                return bodySchemaModels[i];
            }
        }
        return null;
    };

    var _registeredSchemaDefs = [];

    var _createBodySchema = function (bodySchemaModels, obj, defName) {

        defName = defName || "def-" + ObjectHash(obj);

        var schema = {};
        var attributes = {};
        var required = [];
        var properties = {};
        var existsDef = _findDefSchema(bodySchemaModels, defName);

        if (existsDef == null) {

            for (var parameterName in obj) {
                var parameterValue = obj[parameterName];
                if (_.isObject(parameterValue) && !_.isDate(parameterValue) && !_.isBoolean(parameterValue) && !_.isString(parameterValue) && !_.isNumber(parameterValue) && !_.isFunction(parameterValue) && !_.isRegExp(parameterValue) && !_.isArray(parameterValue)) {
                    // Walk subobject
                    var definitionId = "def-" + ObjectHash(parameterName) + ObjectHash(parameterValue) + ObjectHash(defName);

                    var subSchemaObject = _createBodySchema(bodySchemaModels, parameterValue, definitionId);
                    bodySchemaModels = subSchemaObject.bodySchemaModels;

                    if (!_.isEmpty(subSchemaObject.attributes)) {
                        if (subSchemaObject.attributes.required) {
                            required.push(parameterName);
                            delete(subSchemaObject.attributes.required);
                        }
                        schema[parameterName] = subSchemaObject.attributes;
                    }
                    else {
                        schema[parameterName] = {
                            type: "object",
                            "$ref": "#/definitions/" + definitionId
                        };
                    }
                }
                else {

                    if (_.isArray(parameterValue)) {

                        if (_.isEmpty(parameterValue)) {
                            schema[parameterName] = {
                                type: "array",
                                items: {
                                    type: "string"
                                }
                            }
                        }
                        else {
                            if (parameterValue[0] && parameterValue[0].subType && (_.isString(parameterValue[0].subType) || parameterValue[0].subType == Boolean || parameterValue[0].subType == String || parameterValue[0].subType == Array)) {
                                if (parameterValue[0].subType == String) {
                                    schema[parameterName] = {
                                        type: "array",
                                        items: {
                                            type: "string"
                                        }
                                    }
                                }

                                else if (parameterValue[0].subType == Number) {
                                    schema[parameterName] = {
                                        type: "array",
                                        items: {
                                            type: "number"
                                        }
                                    }
                                }
                                else if (parameterValue[0].subType == Boolean) {
                                    schema[parameterName] = {
                                        type: "array",
                                        items: {
                                            type: "boolean"
                                        }
                                    }
                                }
                                else {
                                    schema[parameterName] = {
                                        type: "array",
                                        items: {
                                            type: "string"
                                        }
                                    }
                                }
                            }
                            else {
                                for (var i in parameterValue) {
                                    var definitionId = "def-" + ObjectHash(parameterName) + ObjectHash(parameterValue[i]) + ObjectHash(defName);
                                    var subSchemaObject = _createBodySchema(bodySchemaModels, parameterValue[i], definitionId);
                                    bodySchemaModels = subSchemaObject.bodySchemaModels;
                                }
                                schema[parameterName] = {
                                    type: "array",
                                    items: {
                                        type: "object",
                                        "$ref": "#/definitions/" + definitionId
                                    }
                                }
                            }
                        }
                    }
                    else {
                        // Set attributes
                        if (parameterValue == String) {
                            parameterValue = "string";
                        }

                        if (parameterValue == Number) {
                            parameterValue = "number";
                        }

                        if (parameterValue == Date) {
                            parameterValue = "date";
                        }

                        if (parameterValue == Boolean) {
                            parameterValue = "boolean";
                        }

                        if (parameterValue == Array) {
                            parameterValue = "array";
                        }

                        if (parameterName == "type" && (parameterValue.toLowerCase() == "string" || parameterValue.toLowerCase() == "boolean" || parameterValue.toLowerCase() == "number")) {
                            attributes[parameterName] = parameterValue.toLowerCase();
                        }

                        if (parameterName == "type" && parameterValue.toLowerCase() == "date") {
                            attributes["type"] = "string";
                        }

                        if (parameterName == "required" && parameterValue == true) {
                            attributes["required"] = true;
                        }
                    }
                }
            }

            if (!_.isEmpty(required)) {
                properties = {"properties": schema, required: required}
            }
            else {
                properties = {"properties": schema}
            }

            _registeredSchemaDefs.push(defName);

            bodySchemaModels.push({
                name: defName,
                schema: properties,
                attributes: attributes
            });
            return {bodySchemaModels: bodySchemaModels, attributes: attributes}
        }
        else {
            return {bodySchemaModels: bodySchemaModels, attributes: existsDef["attributes"]}
        }
    };

    /**
     * Create swagger doc definitions
     * @returns {{}}
     * @private
     */
    var _getSwaggerDocResults = function (hostId) {

        var swaggerDocResult = {};
        var registeredServices = Shared.registeredServices();
        var bodySchemaCounter = 0;
        var bodySchemaModels = [];
        var pathArray = [];

        registeredServices = registeredServices.sort(function (a, b) {
            var x = a["name"];
            var y = b["name"];
            return ((x < y) ? -1 : ((x > y) ? 1 : 0));
        });

        for (var index in registeredServices) {
            var service = registeredServices[index];
            var responses = service.responses;
            if (service.docs == true && service.hostId == hostId && service.url.match(/^\//)) {
                var parameters = service.parameters;
                var responseSchemes = {};
                if (!_.isEmpty(responses)) {


                    // Build swagger compatible parameters definition
                    var swaggerParameters = [];

                    if (!_.isEmpty(parameters)) {
                        for (var sectionName in parameters) {
                            var section = parameters[sectionName];
                            var parameterName;
                            if (sectionName != "body") {
                                var swaggerParameter = {};
                                var parameter;
                                for (parameterName in section) {

                                    parameter = section[parameterName];

                                    var type = parameter.type ? parameter.type.toLowerCase() : "string";
                                    if (type != "string" && type != "number" && type != "boolean" && type != "array") {
                                        type = "string";
                                    }

                                    swaggerParameter = {
                                        "in": sectionName,
                                        "name": parameterName,
                                        "type": type,
                                        "description": parameter.desc || "",
                                        "required": parameter.required || false
                                    };
                                    swaggerParameters.push(swaggerParameter);
                                }
                            }
                            else {

                                var thisHash = "def-" + ObjectHash(parameters[sectionName]);
                                var subSchemaObject = _createBodySchema(bodySchemaModels, parameters[sectionName]);
                                bodySchemaModels = subSchemaObject.bodySchemaModels;

                                swaggerParameters.push({
                                    "in": "body",
                                    "name": "body",
                                    schema: {
                                        "$ref": "#/definitions/" + thisHash
                                    }
                                });

                                bodySchemaCounter++;
                            }
                        }
                    }

                    // Build swagger compatible response definition
                    var responseCodes = {};
                    var successHash = null;
                    var errorHash = null;

                    if (!_.isEmpty(service.responseSchemes)) {
                        if (service.responseSchemes.success) {
                            successHash = "def-" + ObjectHash(service.responseSchemes.success);
                            var subSchemaObjectSuccess = _createBodySchema(bodySchemaModels, service.responseSchemes.success);
                            bodySchemaModels = subSchemaObjectSuccess.bodySchemaModels;
                        }
                        if (service.responseSchemes.error) {
                            errorHash = "def-" + ObjectHash(service.responseSchemes.error);
                            var subSchemaObjectError = _createBodySchema(bodySchemaModels, service.responseSchemes.error);
                            bodySchemaModels = subSchemaObjectError.bodySchemaModels;
                        }
                    }

                    for (var responseCode in responses) {
                        if (parseInt(responseCode) == 204) {
                            responseCodes[responseCode] = {
                                "description": responses[responseCode].join(', ')
                            }
                        }
                        else {
                            if (parseInt(responseCode) < 300) {
                                if (successHash) {
                                    responseCodes[responseCode] = {
                                        "description": responses[responseCode].join(', '),
                                        "schema": {
                                            "$ref": "#/definitions/" + successHash
                                        }
                                    }
                                }
                                else {
                                    responseCodes[responseCode] = {
                                        "description": responses[responseCode].join(', '),
                                        "schema": {
                                            "$ref": "#/definitions/Success"
                                        }
                                    }
                                }
                            }
                            else {
                                if (errorHash) {
                                    responseCodes[responseCode] = {
                                        "description": responses[responseCode].join(', '),
                                        "schema": {
                                            "$ref": "#/definitions/" + errorHash
                                        }
                                    }
                                }
                                else {
                                    responseCodes[responseCode] = {
                                        "description": responses[responseCode].join(', '),
                                        "schema": {
                                            "$ref": "#/definitions/Error"
                                        }
                                    }
                                }
                            }
                        }
                    }

                    var swaggerDoc = {
                        "description": service.description || "",
                        "responses": responseCodes
                    };

                    if (service.deprecated === true) {
                        swaggerDoc.description = "NOTICE: THIS SERVICE IS DEPRECATED\n" + swaggerDoc.description;
                    }

                    if (!_.isEmpty(swaggerParameters)) {
                        swaggerDoc.parameters = swaggerParameters;
                    }

                    //add swagger docu, if present
                    var swaggerPath = service.url.replace(/:(\w)+/ig, function (match) {

                        swaggerDoc.parameters = swaggerDoc.parameters || [];
                        var pathVaribleIsDefined = false;
                        for (var pIndex in swaggerParameters) {
                            if (swaggerParameters[pIndex].in == "path" && swaggerParameters[pIndex].name == match.substring(1)) {
                                pathVaribleIsDefined = true
                            }
                        }
                        if (pathVaribleIsDefined == false) {
                            swaggerDoc.parameters.push({
                                "in": "path",
                                "name": match.substring(1),
                                "description": match.substring(1),
                                "required": true,
                                "type": "string"
                            });
                        }

                        return '{' + match.substring(1) + '}';
                    });

                    var env = Shared.config("environment");

                    if (_.isEmpty(swaggerDocResult)) {
                        swaggerDocResult = {};
                        swaggerDocResult["swagger"] = "2.0";
                        swaggerDocResult["info"] = {
                            "title": env.title || "API",
                            "description": env.description || "API documentation",
                            "version": env.version || "1.0"
                        };
                        //swaggerDocResult["host"] = "localhost:3000";
                        swaggerDocResult["basePath"] = "/";
                        swaggerDocResult["produces"] = ["application/json"];
                        swaggerDocResult["definitions"] = {
                            "ServiceDescriptions": {
                                "properties": {
                                    "status": {
                                        "type": "number"
                                    },
                                    response: {
                                        "type": "array",
                                        "items": {
                                            "$ref": "#/definitions/ServiceDescription"
                                        }
                                    }
                                }
                            },
                            "ServiceDescription": {
                                "properties": {
                                    "modified": {
                                        "type": "string"
                                    },
                                    "url": {
                                        "type": "string"
                                    },
                                    "authorization": {
                                        "type": "boolean"
                                    },
                                    "name": {
                                        "type": "string"
                                    },
                                    "requestMethods": {
                                        "type": "array",
                                        "items": {
                                            "type": "string"
                                        }
                                    }
                                }
                            },
                            "Error": {
                                "properties": {
                                    "status": {
                                        type: "number"
                                    },
                                    "errors": {
                                        "type": "array",
                                        "items": {
                                            "$ref": "#/definitions/ErrorDescription"
                                        }
                                    }
                                }
                            },
                            "ErrorDescription": {
                                "properties": {
                                    "code": {
                                        "type": "string"
                                    },
                                    "msg": {
                                        "type": "string"
                                    }
                                }
                            },
                            "Success": {
                                "properties": {
                                    "status": {
                                        "type": "number"
                                    },
                                    response: {}

                                }
                            }
                        };
                        var env = Shared.config('environment');
                        if (env.swagger) {
                            swaggerDocResult = _.merge(swaggerDocResult, _.cloneDeep(Shared.config('environment.swagger')));
                        }
                    }

                    //Register body schema models
                    for (var sIndex in bodySchemaModels) {
                        swaggerDocResult.definitions[bodySchemaModels[sIndex].name] = bodySchemaModels[sIndex].schema;
                    }

                    for (var rSIndex in responseSchemes) {
                        //swaggerDocResult.definitions[rSIndex] = responseSchemes[rSIndex];
                    }

                    swaggerDocResult.paths = swaggerDocResult.paths || {};

                    var data = swaggerDoc;

                    if (service.deprecated === true) {
                        data.tags = [service.name + " (deprecated)"];
                    }
                    else {
                        data.tags = [service.name];
                    }

                    pathArray.push({
                        name: (service.name + swaggerPath + service.requestMethod.toLowerCase()).replace(/[^a-zA-Z0-9]+/g, ""),
                        requestMethod: service.requestMethod.toLowerCase(),
                        path: swaggerPath,
                        data: data
                    });
                }
            }
        }


        if (!_.isEmpty(pathArray)) {
            swaggerDocResult.paths = swaggerDocResult.paths || {};
            pathArray = pathArray.sort(function (a, b) {
                var x = a["name"];
                var y = b["name"];
                return ((x < y) ? -1 : ((x > y) ? 1 : 0));
            });

            for (var index in pathArray) {
                var path = pathArray[index]["path"];
                swaggerDocResult.paths[path] = swaggerDocResult.paths[path] || {};
                swaggerDocResult.paths[path][pathArray[index]["requestMethod"]] = pathArray[index]["data"]
            }
        }

        return swaggerDocResult;

    };

    // Start swagger
    self.register = function (hosts) {

        for (var hostId in hosts) {
            var swaggerDocResult = _getSwaggerDocResults(hostId);

            if (!_.isEmpty(swaggerDocResult)) {
                // Initialize the Swagger middleware
                SwaggerTools.initializeMiddleware(swaggerDocResult, function (swaggerMiddleware) {

                    // Add cache controll header to swagger routes
                    hosts[hostId]["express"].use(function (req, res, next) {
                        var maxAge = 0;
                        res.setHeader('Cache-Control', 'public, max-age=' + maxAge);
                        next();
                    });

                    // Interpret Swagger resources and attach metadata to request - must be first in swagger-tools middleware chain
                    hosts[hostId]["express"].use(swaggerMiddleware.swaggerMetadata());

                    //// Validate Swagger requests
                    //hosts[host].use(swaggerMiddleware.swaggerValidator());

                    //// Route validated requests to appropriate controller
                    //hosts[host].use(swaggerMiddleware.swaggerRouter(options));

                    // Serve the Swagger documents and Swagger UI
                    hosts[hostId]["express"].use(swaggerMiddleware.swaggerUi());


                });
            }
        }

    };


    return self;
};

module.exports = new thisModule();