var Shared = require('./../../shared')
    , Path = require('path')
    , Fs = require('fs')
    , SwaggerParser = require('swagger-parser')
    , _ = require('lodash')
    , ObjectHash = require('object-hash')
    , Logger = require('./../../logger').tag('swagger-docs');

function thisModule() {
    var self = this;

    var _findDefSchema = function (defName) {
        if (_registeredSchemaDefs[defName]) {
            return _registeredSchemaDefs[defName];
        }
        return null;
    };

    var _registeredSchemaDefs = {};
    var _reusedSchemaDefs = {};
    var _foundDefs = 0;

    var _createSchema = function (obj, defName) {

        defName = defName || "def-" + ObjectHash(obj);

        var schema = {};
        var attributes = {};
        var required = [];
        var properties = {};
        var existsDef = _findDefSchema(defName);

        if (existsDef === null) {

            for (var parameterName in obj) {
                var parameterValue = obj[parameterName];
                if (_.isObject(parameterValue) && !_.isDate(parameterValue) && !_.isBoolean(parameterValue) && !_.isString(parameterValue) && !_.isNumber(parameterValue) && !_.isFunction(parameterValue) && !_.isRegExp(parameterValue) && !_.isArray(parameterValue)) {
                    // Walk subobject
                    var definitionId = "def-" + ObjectHash(parameterName) + ObjectHash(parameterValue) + ObjectHash(defName);

                    var bodySchema = _createSchema(parameterValue, definitionId);

                    if (!_.isEmpty(bodySchema.attributes)) {
                        if (bodySchema.attributes.required) {
                            required.push(parameterName);
                            delete (bodySchema.attributes.required);
                        }
                        schema[parameterName] = bodySchema.attributes;
                    } else {
                        schema[parameterName] = {
                            type: "object",
                            "properties": bodySchema.schema.properties
                        };
                    }
                } else {

                    if (_.isArray(parameterValue)) {

                        if (_.isEmpty(parameterValue)) {
                            schema[parameterName] = {
                                type: "array",
                                items: {
                                    type: "string"
                                }
                            }
                        } else {
                            if (parameterValue[0] && parameterValue[0].subType && (_.isString(parameterValue[0].subType) || parameterValue[0].subType == Boolean || parameterValue[0].subType == String || parameterValue[0].subType == Array)) {
                                if (parameterValue[0].subType == String) {
                                    schema[parameterName] = {
                                        type: "array",
                                        items: {
                                            type: "string"
                                        }
                                    }
                                } else if (parameterValue[0].subType == Number) {
                                    schema[parameterName] = {
                                        type: "array",
                                        items: {
                                            type: "number"
                                        }
                                    }
                                } else if (parameterValue[0].subType == Boolean) {
                                    schema[parameterName] = {
                                        type: "array",
                                        items: {
                                            type: "boolean"
                                        }
                                    }
                                } else {
                                    schema[parameterName] = {
                                        type: "array",
                                        items: {
                                            type: "string"
                                        }
                                    }
                                }
                            } else {
                                for (var i in parameterValue) {
                                    var definitionId = "def-" + ObjectHash(parameterName) + ObjectHash(parameterValue[i]) + ObjectHash(defName);
                                    var someSchema = _createSchema(parameterValue[i], definitionId);
                                }
                                schema[parameterName] = {
                                    type: "array",
                                    items: {
                                        type: "object",
                                        "properties": someSchema.schema.properties
                                    }
                                }
                            }
                        }
                    } else {
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
            } else {
                properties = {"properties": schema}
            }

            var bodySchema = {
                name: defName,
                schema: properties,
                attributes: attributes
            };

            _registeredSchemaDefs[defName] = bodySchema;

            return bodySchema;
        } else {
            _foundDefs++;
            _reusedSchemaDefs[defName] = existsDef;

            /*return {
                name: existsDef.name,
                schema: {
                    "$ref": "#/components/schemas/" + existsDef.name
                },
                attributes: existsDef.attributes
            };*/
            return existsDef
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
        var pathArray = [];
        var services = {};
        var env = Shared.config("environment");

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

                if (!_.isEmpty(responses)) {

                    // Build swagger compatible parameters definition
                    var swaggerParameters = [];
                    var requestBody = {}

                    if (!_.isEmpty(parameters)) {
                        for (var sectionName in parameters) {
                            var section = parameters[sectionName];
                            var parameterName;
                            if (sectionName != "body") {
                                var swaggerParameter = {};
                                var parameter;
                                for (parameterName in section) {

                                    parameter = section[parameterName];

                                    // Skip parameters which should not be shown in the documentation
                                    if (_.get(parameter, 'docs') === false) continue;

                                    var type = parameter.type ? parameter.type.toLowerCase() : "string";
                                    if (type != "string" && type != "number" && type != "boolean" && type != "array") {
                                        type = "string";
                                    }

                                    swaggerParameter = {
                                        "in": sectionName,
                                        "name": parameterName,
                                        "description": parameter.desc || "",
                                        "required": parameter.required || false,
                                        "schema": {
                                            "type": type,
                                        }
                                    };
                                    swaggerParameters.push(swaggerParameter);
                                }
                            } else {

                                var thisHash = "def-" + ObjectHash(parameters[sectionName]);
                                var anotherSchema = _createSchema(parameters[sectionName], thisHash);

                                requestBody = {
                                    "content": {
                                        "application/json": {
                                            "schema": anotherSchema.schema
                                        }
                                    }
                                };
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
                            var successSchema = _createSchema(service.responseSchemes.success, successHash);
                        }
                        if (service.responseSchemes.error) {
                            errorHash = "def-" + ObjectHash(service.responseSchemes.error);
                            var errorSchema = _createSchema(service.responseSchemes.error, errorHash);
                        }
                    }

                    for (var responseCode in responses) {
                        if (parseInt(responseCode) == 204) {
                            responseCodes[responseCode] = {
                                "description": responses[responseCode].join(', ')
                            }
                        } else {
                            if (parseInt(responseCode) < 300) {
                                if (successHash) {
                                    responseCodes[responseCode] = {
                                        "description": responses[responseCode].join(', '),
                                        "content": {
                                            "application/json": {
                                                "schema": successSchema.schema
                                            }
                                        }
                                    }
                                } else {
                                    responseCodes[responseCode] = {
                                        "description": responses[responseCode].join(', '),
                                        "content": {
                                            "application/json": {
                                                "schema": {
                                                    "$ref": "#/components/schemas/Success"
                                                }
                                            }
                                        }
                                    }
                                }
                            } else {
                                if (errorHash) {
                                    responseCodes[responseCode] = {
                                        "description": responses[responseCode].join(', '),
                                        "content": {
                                            "application/json": {
                                                "schema": errorSchema.schema
                                            }
                                        }
                                    }
                                } else {
                                    responseCodes[responseCode] = {
                                        "description": responses[responseCode].join(', '),
                                        "content": {
                                            "application/json": {
                                                "schema": {
                                                    "$ref": "#/components/schemas/Error"
                                                }
                                            }
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
                        swaggerDoc.deprecated = true;
                        swaggerDoc.description = "NOTICE: THIS SERVICE IS DEPRECATED\n" + swaggerDoc.description;
                    }

                    if (!_.isEmpty(swaggerParameters)) {
                        swaggerDoc.parameters = swaggerParameters;
                    }

                    if (!_.isEmpty(requestBody)) {
                        swaggerDoc.requestBody = requestBody
                    }

                    //add swagger doc, if present
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
                                "schema": {
                                    "type": "string"
                                }
                            });
                        }

                        return '{' + match.substring(1) + '}';
                    });

                    if (_.isEmpty(swaggerDocResult)) {
                        swaggerDocResult = {};
                        swaggerDocResult["openapi"] = "3.0.0";
                        swaggerDocResult["info"] = {
                            "title": env.title || "API",
                            "description": env.description || "API documentation",
                            "version": env.version || "1.0"
                        };
                        swaggerDocResult["components"] = {
                            "schemas": {
                                "ServiceDescriptions": {
                                    "properties": {
                                        "status": {
                                            "type": "number"
                                        },
                                        response: {
                                            "type": "array",
                                            "items": {
                                                "$ref": "#/components/schemas/ServiceDescription"
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
                                                "$ref": "#/components/schemas/ErrorDescription"
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
                            }
                        };

                        if (env.swagger) {
                            swaggerDocResult = _.merge(swaggerDocResult, _.cloneDeep(Shared.config('environment.swagger')));
                        }
                    }

                    // Register reused/referenced schema models
                    /*for (var sIndex in _reusedSchemaDefs) {
                        swaggerDocResult.components.schemas[_reusedSchemaDefs[sIndex].name] = _reusedSchemaDefs[sIndex].schema;
                    }*/

                    swaggerDocResult.paths = swaggerDocResult.paths || {};

                    var data = swaggerDoc;

                    if (service.deprecated === true) {
                        data.tags = [service.name + " (deprecated)"];
                    } else {
                        data.tags = [service.name];
                    }

                    pathArray.push({
                        name: (service.name + swaggerPath + service.requestMethod.toLowerCase()).replace(/[^a-zA-Z0-9]+/g, ""),
                        requestMethod: service.requestMethod.toLowerCase(),
                        path: swaggerPath,
                        data: data
                    });
                    if (!services[service.name]) {
                        services[service.name] = 0
                    }
                    services[service.name]++
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

        if (env.identity === 'local') {
            // Print metrics
            const serviceCount = Object.keys(services).length;
            const pathCount = pathArray.length;
            const registeredSchemaCount = Object.keys(_registeredSchemaDefs).length;
            const reusedSchemaCount = Object.keys(_reusedSchemaDefs).length;
            const ratio = (reusedSchemaCount / registeredSchemaCount) * 100;
            Logger.info('[Printing swagger metrics]-------------------------------------------');
            for (const serviceName in services) {
                Logger.info(serviceName + ': ' + services[serviceName] + ' paths');
            }
            Logger.info('[Total amounts] Services: ' + serviceCount + '; Paths: ' + pathCount);
            Logger.info('[Schema metrics] Registered schemas: ' + registeredSchemaCount + '; Reused schemas: ' + reusedSchemaCount + '; Reuses: ' + _foundDefs);
            Logger.info('[Registered/reused ratio] ' + Math.round(ratio * 100) / 100);
            Logger.info('---------------------------------------------------------------------');
        }

        return swaggerDocResult;
    };

    // Start swagger
    self.register = function (hosts) {

        return Promise.all(Object.keys(hosts).map((hostId) => {
            var swaggerDocResult = _getSwaggerDocResults(hostId);

            if (!_.isEmpty(swaggerDocResult)) {
                return SwaggerParser.validate(swaggerDocResult)
                    .then((swaggerSpec) => {
                        const swaggerUIDir = require('swagger-ui-dist').absolutePath();
                        const swaggerUIIndex = Fs.readFileSync(Path.join(__dirname, './swagger.html'), 'utf8');

                        hosts[hostId]["router"].get('/api-docs', (req, res) => {
                            res.set('Cache-Control', 'no-cache');
                            res.json(swaggerSpec);
                        });
                        hosts[hostId]["router"].get('/docs', (req, res) => {

                            const env = Shared.config('environment');
                            const swaggerHost = _.get(env, 'swagger.host');
                            const protocol = req.headers && req.headers['x-forwarded-proto'] ? req.headers['x-forwarded-proto'] : req.protocol;
                            const currentHost = req.headers.host;

                            if (swaggerHost && currentHost !== swaggerHost) {
                                const redirUrl = protocol + '://' + swaggerHost + '/docs';
                                res.redirect(301, redirUrl);
                                return
                            }

                            if (!req.originalUrl.endsWith('/')) {
                                res.redirect(301, req.originalUrl + '/');
                                return;
                            }

                            res.set('Cache-Control', 'public, max-age=3600');
                            res.send(swaggerUIIndex);
                        });
                        hosts[hostId]["router"].use('/docs', Shared.express().static(swaggerUIDir, {maxAge: '1h'}));
                    })
                    .catch((err) => {
                        console.error(err);
                        process.exit(1);
                    });
            }
        }));
    };

    return self;
}

module.exports = new thisModule();