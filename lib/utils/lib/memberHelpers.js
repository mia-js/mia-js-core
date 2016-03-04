_ = require('lodash')
    , ObjectID = require('mongodb').ObjectID;

function thisModule() {
    var self = this;

    /**
     * Path as string "property1.property2.property3" or array [property1, property2, property3] to array [property1, property2, property3]
     * @param path
     * @returns {*}
     */
    var pathToAray = function (path) {
        if (_.isArray(path)) {
            return path;
        }
        else if (_.isString(path)) {
            return path.split('.');
        }
    };

    /**
     * Checks if a deep property exists
     * @param object
     * @param path: accepts string "property1.property2.property3" or array [property1, property2, property3]
     * @returns {boolean}
     */
    self.hasPathPropertyValue = function (obj, prop) {
        var parts = prop.split('.');
        for (var i = 0, l = parts.length; i < l; i++) {
            var part = parts[i];
            if (obj !== null && typeof obj === "object" && part in obj) {
                obj = obj[part];
            }
            else {
                return false;
            }
        }
        return true;
    };

    /**
     * Checks if a deep property exists and returns empty string if unset
     * @param object
     * @param path: accepts string "property1.property2.property3" or array [property1, property2, property3]
     * @returns {string}
     */
    self.ifExists = function (object, path) {
        var pathParts = pathToAray(path);

        var partialValue = object;
        for (var pathLevel in pathParts) {
            if (partialValue == null) {
                return;
            }
            else {
                partialValue = partialValue[pathParts[pathLevel]];
            }
        }

        return partialValue;
    };

    /**
     * Gets deep property at given path
     * @param path: accepts string "property1.property2.property3" or array [property1, property2, property3]
     * @param path
     * @returns {*}
     */
    self.getPathPropertyValue = function (object, path) {
        var pathParts = pathToAray(path);

        var partialValue = object;
        for (var pathLevel in pathParts) {
            if (partialValue == null) {
                return;
            }
            partialValue = partialValue[pathParts[pathLevel]];
        }

        return partialValue;
    };

    /**
     * Sets deep property at given path
     * @param path: accepts string "property1.property2.property3" or array [property1, property2, property3]
     * @param path
     * @param value
     */
    self.setPathPropertyValue = function (object, path, value) {
        var pathParts = pathToAray(path);

        var partialValue = object;
        var pathLevel;
        for (var i = 0; i < pathParts.length; ++i) {
            pathLevel = pathParts[i];

            if (i === pathParts.length - 1) {
                //set the leaf node value
                partialValue[pathLevel] = value;
                return;
            }

            //check if value within the tree exists and if it doesn't create it
            if (partialValue[pathLevel] == null) {
                partialValue[pathLevel] = {};
            }

            //iterate further
            partialValue = partialValue[pathLevel];
        }
    };

    /**
     * Copies values from input instance to output instance doing property name mapping in between
     * @param inputInstance
     * @param outputInstance
     * @param mapping
     *  var exampleMapping = {
            "abc.def": "test1.def",
            "adc.ffg": "test2.dgd"
        };
     */
    self.cloneValuesUsingMapping = function (inputInstance, outputInstance, mapping) {
        for (var entry in mapping) {
            if (!mapping.hasOwnProperty(entry)) {
                continue;
            }

            var value = self.getPathPropertyValue(inputInstance, entry);
            self.setPathPropertyValue(outputInstance, mapping[entry], value);
        }
    };

    /**
     * https://github.com/vardars/dotize
     * Convert (Complex JSON object)
     * { "status": "success",
     *   "auth": {
     *      "code": "23123213",
     *      "name": "qwerty asdfgh"
     *   }
     * }
     * to (Dot notation JSON object)
     * {
     *   "status": "success",
     *   "auth.code": "23123213",
     *   "auth.name": "qwerty asdfgh"
     * }
     * @param jsonobj
     * @param prefix
     * @returns {*}
     */
    self.dotize = function (jsonobj, prefix) {
        var newobj = {};

        function recurse(object, prefix, isArrayItem) {
            for (var item in object) {
                if (object[item] instanceof Date) {
                    newobj[(prefix ? prefix + "." : "") + item] = object[item];
                }
                else if (object[item] instanceof ObjectID) {
                    newobj[(prefix ? prefix + "." : "") + item] = object[item];
                }
                //TODO: Check for other datatypes if needed
                else if (object[item] && typeof object[item] === "object") {
                    if (Array.isArray(object[item]))
                        newobj = recurse(object[item], (prefix ? prefix + "." : "") + item, true); // array
                    else {
                        if (isArrayItem)
                            newobj = recurse(object[item], (prefix ? prefix : "") + "[" + item + "]"); // array item object
                        else
                            newobj = recurse(object[item], (prefix ? prefix + "." : "") + item); // object
                    }
                }
                else if (isArrayItem) {
                    // array item primitive
                    newobj[prefix + "[" + item + "]"] = object[item];
                }
                else {
                    // primitive
                    newobj[(prefix ? prefix + "." : "") + item] = object[item];
                }
            }
            return newobj;
        }

        return recurse(jsonobj, prefix);
    };

    return self;
};

module.exports = new thisModule();
