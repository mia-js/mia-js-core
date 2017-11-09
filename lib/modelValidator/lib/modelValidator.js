/**
 * Validation of a model
 * @type {exports}
 * @private
 */

/*
 INPUT: Input values can be multidimensional objects or parameters like culture.language
 Parameters with dot-notation will be converted to multidimensional objects automatically

 OUTPUT: In case of validation errors it returns all errors.
 In case of valid parameters it returns all parameters with applied conversions defined in the model

 RULES:
 The following attributes are possible to define in a model:
 type:      ['Boolean','String','Number','Date','Array'] - defines the type of the value
 subType:   ['Boolean','String','Number','Date','Array'] - defines the type of the value of elements of an object type array
 maxLength: [Number] i.e. 32 - Maximum length of chars of a value
 minLength: [Number] i.e. 32 - Minimum length of chars of a value
 required:  [true|false] - Set if value is required
 unique:    [true|false] - Set if value should be unique
 public:    [true|false] {set:true,get:false} - Allow values to be set or the get. Set=false means disallow this value to be added manually. Use virtual to generate value by function instead. Get=false means this value is not part of the output of validation. Values will be deleted after processing
 index:     [true|false] - Set if an index should be applied to value
 convert:   ['upper','lower'] - Convert value to upper or lower case
 match:     [RegEx] i.e. /[a-zA-Z]{2}/i - Value must match to regular expression
 default:   [Number|Boolean|String|Function] i.e. 'inactive' - Set a default value is not set
 nullable:    [Boolean] - Defines if a value is set to null in case of no given value
 virtual:   [String|Function] - Apply a defined virtual function to convert value with a custom function and add to values
 max:       [Number] i.e. 20 - Max number a value can have, only for numbers
 min:       [Number] i.e. 1 - Min number a value must have, only for numbers
 allow:     [Array|Number|String] i.e. [2, 3, 4] - Define a allowed value or array the value must have (case-in-sensitiv)
 deny:      [Array|Number|String] i.e. [2, 3, 4] - Define a denied value or array that is not allowed (case-in-sensitiv)
 extend:    [Function] - Define a function that extends a schema definition dynamically i.e. iterate function [1...20] ==> name: 1,{type: Number, default: 0}

 To allow a node to consist any data without validation use empty {} without definitions i.e. mydata:  {}
 */


var _ = require('lodash')
    , validationRule = require('./rules')
    , convert = require('./convert');

/**
 * Match schema rules with given value
 * @param value
 * @param schema
 * @param name
 * @param callback
 */
var rulesMatch = function (name, value, schema, options, callback) {

    var err
        , nullable = false
        , valCount = 0;

    // Set default values
    if (options && options.partial !== true) {
        if (schema.hasOwnProperty('default') && value === undefined) {
            if ((_.isString(schema.default) || _.isBoolean(schema.default) || _.isNumber(schema.default)) || (schema.hasOwnProperty('nullable') && schema.nullable === true && _.isNull(schema.default))) {
                value = schema.default;
            }
            else {
                if (_.isFunction(schema.default)) {
                    value = (schema.default)();
                }
                else {
                    err = _.assign({
                        code: 'UnexpectedDefaultValue',
                        'id': name,
                        msg: name + ' default value is faulty. ' + typeof(schema.default) + ' given but not expected'
                    }, err);
                }
            }
        }
    }
    if (value !== undefined) {

        // Check if null value set and is allowed
        if ((schema.hasOwnProperty('nullable') && schema.nullable === true) && value == null) {
            value = null;
        }
        else {
            //Check type
            if (schema.hasOwnProperty('type')) {
                if (_.isFunction(schema.type) && (schema.type.name).toLowerCase()) {
                    schema.type = (schema.type.name).toLowerCase();
                }
                var validValue = validationRule.checkType(schema.type, value);
                if (validValue === undefined) {
                    err = _.assign({
                        code: 'UnexpectedType',
                        'id': name,
                        msg: name + ' is unexpected type. ' + typeof(value) + ' given ' + (schema.type).toLowerCase() + ' expected'
                    }, err);
                }
                else {
                    value = validValue;
                }
            }

            //Validate single value
            if ((_.isString(value) || _.isBoolean(value) || _.isNumber(value))) {

                //Check minLength
                if (schema.hasOwnProperty('minLength')) {
                    if (validationRule.minLength(schema.minLength, value) == false) {
                        err = _.assign({
                            code: 'MinLengthUnderachieved',
                            'id': name,
                            msg: name + ' length is less than ' + schema.minLength + ' chars'
                        }, err);
                    }
                }

                //Check maxLength
                if (schema.hasOwnProperty('maxLength')) {
                    if (validationRule.maxLength(schema.maxLength, value) == false) {
                        err = _.assign({
                            code: 'MaxLengthExceeded',
                            'id': name,
                            msg: name + ' length is more than ' + schema.maxLength + ' chars'
                        }, err);
                    }
                }


                //Check min
                if (schema.hasOwnProperty('min')) {
                    if (typeof(value) == 'number') {
                        if (validationRule.min(schema.min, value) == false) {
                            err = _.assign({
                                code: 'MinValueUnderachived',
                                'id': name,
                                msg: name + ' value is less than ' + schema.min
                            }, err);
                        }
                    }
                }

                //Check max
                if (schema.hasOwnProperty('max')) {
                    if (typeof(value) == 'number') {
                        if (validationRule.max(schema.max, value) == false) {
                            err = _.assign({
                                code: 'MaxValueExceeded',
                                'id': name,
                                msg: name + ' value is more than ' + schema.max
                            }, err);
                        }
                    }
                }

                //Check allow
                if (schema.hasOwnProperty('allow')) {
                    if (typeof(value) == 'number' || typeof(value) == 'string') {
                        if (validationRule.allow(schema.allow, value) == false) {
                            err = _.assign({
                                code: 'ValueNotAllowed',
                                'id': name,
                                msg: name + ' value \'' + value + '\' is not allowed. Use one of the following values: ' + (schema.allow).join(",")
                            }, err);
                        }
                    }
                }

                //Check deny
                if (schema.hasOwnProperty('deny')) {
                    if (typeof(value) == 'number' || typeof(value) == 'string') {
                        if (validationRule.deny(schema.deny, value) == false) {
                            err = _.assign({
                                code: 'ValueNotAllowed',
                                'id': name,
                                msg: name + ' value \'' + value + '\' is not allowed. Do not use one of the following values: ' + (schema.deny).join(",")
                            });
                        }
                    }
                }

                //Check match
                if (schema.hasOwnProperty('match')) {
                    if (validationRule.match(schema.match, value) == false) {
                        err = _.assign({
                            code: 'PatternMismatch',
                            'id': name,
                            msg: name + ' does not match pattern ' + schema.match + ''
                        }, err);
                    }
                }


                // Convert values
                value = convert.convertValue(schema, value);
            }
        }

        //Validate Array
        if (_.isArray(value)) {
            for (var thisVal in value) {
                valCount++;
                // Check if null value set and is allowed
                if ((schema.hasOwnProperty('nullable') && schema.nullable === true) && value == null) {
                    value = null;
                }
                else {
                    //Check type
                    if (schema.hasOwnProperty('subType')) {
                        if (_.isFunction(schema.subType) && (schema.subType.name).toLowerCase()) {
                            schema.subType = (schema.subType.name).toLowerCase();
                        }
                        var validSubValue = validationRule.checkType(schema.subType, value[thisVal]);
                        if (validSubValue === undefined) {
                            err = _.assign({
                                code: 'UnexpectedType',
                                'id': name,
                                msg: name + '[' + valCount + ']' + ' is unexpected type. ' + typeof(value[thisVal]) + ' given ' + (schema.subType).toLowerCase() + ' expected'
                            }, err);
                        }
                        else {
                            value[thisVal] = validSubValue;
                        }
                    }

                    //Check minLength
                    if (schema.hasOwnProperty('minLength')) {
                        if (validationRule.minLength(schema.minLength, value[thisVal]) == false) {
                            err = _.assign({
                                code: 'MinLengthUnderachieved',
                                'id': name,
                                msg: name + '[' + valCount + ']' + ' length is less than ' + schema.minLength + ' chars'
                            }, err);
                        }
                    }

                    //Check maxLength
                    if (schema.hasOwnProperty('maxLength')) {
                        if (validationRule.maxLength(schema.maxLength, value[thisVal]) == false) {
                            err = _.assign({
                                code: 'MaxLengthExceeded',
                                'id': name,
                                msg: name + '[' + valCount + ']' + ' length is more than ' + schema.maxLength + ' chars'
                            }, err);
                        }
                    }


                    //Check min
                    if (schema.hasOwnProperty('min')) {
                        if (typeof(value) == 'number') {
                            if (validationRule.min(schema.min, value[thisVal]) == false) {
                                err = _.assign({
                                    code: 'MinValueUnderachived',
                                    'id': name,
                                    msg: name + '[' + valCount + ']' + ' value is less than ' + schema.min
                                }, err);
                            }
                        }
                    }

                    //Check max
                    if (schema.hasOwnProperty('max')) {
                        if (typeof(value) == 'number') {
                            if (validationRule.max(schema.max, value[thisVal]) == false) {
                                err = _.assign({
                                    code: 'MaxValueExceeded',
                                    'id': name,
                                    msg: name + '[' + valCount + ']' + ' value is more than ' + schema.max
                                }, err);
                            }
                        }
                    }

                    //Check allow
                    if (schema.hasOwnProperty('allow')) {
                        if (typeof(value) == 'number' || typeof(value[thisVal]) == 'string') {
                            if (validationRule.allow(schema.allow, value[thisVal]) == false) {
                                err = _.assign({
                                    code: 'ValueNotAllowed',
                                    'id': name,
                                    msg: name + '[' + valCount + ']' + ' value \'' + value[thisVal] + '\' is not allowed. Use one of the following values: ' + (schema.allow).join(",")
                                }, err);
                            }
                        }
                    }

                    //Check deny
                    if (schema.hasOwnProperty('deny')) {
                        if (typeof(value) == 'number' || typeof(value[thisVal]) == 'string') {
                            if (validationRule.deny(schema.deny, value[thisVal]) == false) {
                                err = _.assign({
                                    code: 'ValueNotAllowed',
                                    'id': name,
                                    msg: name + '[' + valCount + ']' + ' value \'' + value[thisVal] + '\' is not allowed. Do not use one of the following values: ' + (schema.deny).join(",")
                                });
                            }
                        }
                    }

                    //Check match
                    if (schema.hasOwnProperty('match')) {
                        if (validationRule.match(schema.match, value[thisVal]) == false) {
                            err = _.assign({
                                code: 'PatternMismatch',
                                'id': name,
                                msg: name + '[' + valCount + ']' + ' does not match pattern ' + schema.match + ''
                            }, err);
                        }
                    }
                    // Convert values
                    value[thisVal] = convert.convertValue(schema, value[thisVal]);
                }
            }
        }
    }


    //Check required
    if (schema.hasOwnProperty('required')) {
        if (options && options.partial !== true) {
            if (schema.required == true && (value == undefined || value == "")) {
                if ((schema.hasOwnProperty('public') && schema.public.hasOwnProperty('set') && schema.public.set == false) || (schema.hasOwnProperty('nullable') && schema.nullable === true && _.isNull(value))) {

                }
                else {
                    err = _.assign({
                        code: 'MissingRequiredParameter',
                        id: name,
                        msg: name + ' is required but invalid value or no value given'
                    }, err);
                }
            }
        }
    }

    //Check public
    if (schema.hasOwnProperty('public')) {
        if (schema.public == false || ((schema.public.hasOwnProperty('get') && schema.public.get != true))) {
            value = undefined;
        }
    }
    callback(err, value);
};

/**
 * Find all objects with given filter property and returns flat list of elements
 * @param obj
 * @param filter - optional. If empty returns all objects
 * @returns {boolean}
 */
var find = function (obj, filter) {
    var result = {};

    var walk = function (obj, filter, result, path, originObj) {
        var elem
            , arrResult;
        if (!originObj) {
            var originObj = obj;
        }
        if (!path) {
            path = '';
        }
        if (_.isObject(obj) && !_.isRegExp(obj) && !_.isFunction(obj)) {

            if (_.isEmpty(obj)) {
                result[path] = {}
            }
            else {

                for (var value in obj) {
                    if (_.isObject(obj[value]) && !_.isRegExp(obj[value]) && !_.isFunction(obj[value]) && value != 'public' && value != 'virtual' && value != 'allow' && value != 'deny' && value != 'convert') {
                        if (_.isArray(obj[value])) {

                            //Check if empty array
                            if (_.isEmpty((obj[value]))) {

                                if (_.isEmpty(path)) {
                                    elem = value;
                                }
                                else {
                                    elem = path + '.' + value + '';
                                }

                                if (!result[elem]) {
                                    result[elem] = [];
                                }
                            }
                            else {
                                //Check child elements of array
                                for (var thisArrayElem in obj[value]) {
                                    if (_.isEmpty(path)) {
                                        elem = value;
                                    }
                                    else {
                                        elem = path + '.' + value + ''; //This is somehow not correct
                                    }
                                    if (!result[elem]) {
                                        result[elem] = [];
                                    }
                                    arrResult = find(obj[value][thisArrayElem], filter);
                                    if (arrResult) {
                                        (result[elem]).push(arrResult);
                                    }

                                }
                            }
                        }
                        else {

                            var subPath = _.isEmpty(path) ? value : path + '.' + value + '';

                            if (!filter || value == filter) {
                                if (path == '') {
                                    try {
                                        result[value] = eval('originObj' + generateObjectPath(value) + '');
                                    } catch (e) {
                                    }
                                }
                                else {
                                    try {
                                        result[path] = eval('originObj' + generateObjectPath(path) + '');
                                    } catch (e) {
                                    }
                                }
                            }

                            result = walk(obj[value], filter, result, subPath, originObj);
                        }
                    }
                    else {

                        if (!filter || value == filter) {
                            if (path == '') {
                                try {
                                    result[value] = eval('originObj' + generateObjectPath(value) + '');
                                } catch (e) {
                                }
                            }
                            else {
                                try {
                                    result[path] = eval('originObj' + generateObjectPath(path) + '');
                                } catch (e) {
                                }
                            }
                        }

                    }
                }
            }
        }

        return result;
    };

    var resultArray = walk(obj, filter, result);
    return _.isEmpty(resultArray) ? false : resultArray;
};

/**
 * Convert dot notation to [] notation
 * @param obj
 * @returns {string}
 */
var generateObjectPath = function (obj) {
    var objectArray = obj.split(".");
    var evalPath = "";
    for (var i in objectArray) {
        evalPath += '["' + objectArray[i] + '"]';
    }
    return evalPath;
};

var findKeys = function (obj, filter) {
    var result = {};
    var walk = function (obj, filter, result, path, originObj) {
        if (!originObj) {
            var originObj = obj;
        }
        if (!path) {
            path = '';
        }

        if (_.isObject(obj) && !_.isRegExp(obj) && !_.isFunction(obj)) {
            for (var value in obj) {
                if (_.isObject(obj[value]) && !_.isRegExp(obj[value]) && !_.isFunction(obj[value]) && value != 'public' && value != 'virtual') {
                    if (_.isArray(obj[value])) {
                        var subPath = _.isEmpty(path) ? value : path + '.' + value;
                        for (var thisSubArray in obj[value]) {
                            result = walk(obj[value][thisSubArray], filter, result, subPath, originObj);
                        }
                    }
                    else {
                        var subPath = _.isEmpty(path) ? value : path + '.' + value;
                        /*if (value == filter) {
                         if (_.isEmpty(path)) {
                         result[value] = eval('originObj["' + value + '"]');
                         }
                         else {
                         result[path] = eval('originObj["' + path + '"]');
                         }
                         }*/
                        result = walk(obj[value], filter, result, subPath, originObj);
                    }
                }
                else {
                    if (!filter || value == filter) {
                        if (path == '') {
                            try {
                                result[value] = eval('originObj' + generateObjectPath(value) + '');
                            } catch (e) {
                            }
                        }
                        else {
                            result[path] = obj;
                        }
                    }
                }
            }
        }
        return result;
    };

    var resultArray = walk(obj, filter, result);
    return _.isEmpty(resultArray) ? false : resultArray;
};


/**
 * Convert all string parameters with '.' in key name to nested objects
 * @param obj
 * @returns {}
 */
var unplainValues = function (obj) {
    var convertToObjects = function (values) {
        var nestedValues = values;
        //_.forEach(values, function (value, key) {
        if (_.isArray(values)) {
            for (var key in values) {
                nestedValues[key] = convertToObjects(values[key]);
            }
        }
        else if (_.isObject(values)) {
            for (var key in values) {

                if (_.isArray(values[key])) {
                    if (typeof values[key][0] == "object") {
                        nestedValues[key] = convertToObjects(values[key]);
                    }
                    else {
                        var replaceObjects = setNestedObjects(values[key], key);
                        delete(nestedValues[key]);
                        nestedValues = _.merge(nestedValues, replaceObjects);
                        //nestedValues[key] = values[key];
                    }
                }
                else {

                    var replaceObjects = setNestedObjects(values[key], key);
                    delete(nestedValues[key]);
                    nestedValues = _.merge(nestedValues, replaceObjects);
                }
            }
        }

        //});
        return nestedValues;
    };
    var setNestedObjects = function (value, path) {
        var obj = {};
        var pathArray = [];
        if (typeof path == "string") {
            pathArray = path.split('.');
        }
        if (pathArray.length > 1) {
            //var p = path.shift();

            //if (obj2[p] == null || typeof obj2[p] !== 'object') {
            //   obj2[p] = {};
            //}
            var newPath = path.replace(pathArray[0] + '.', '');
            if (!_.isEmpty(newPath)) {
                obj[pathArray[0]] = setNestedObjects(value, newPath);
            }

            //obj2[path] = setNestedObjects(value, path, obj2[p]);
        } else {
            obj[pathArray[0]] = value;

        }
        return obj;
    };

    obj = convertToObjects(obj);
    return obj;
};

/**
 * Convert all nested objects to plain list where keys are splitted with '.'
 * @param obj
 * @returns {}
 */
var plainValues = function (obj) {
    var result = {};

    var walk = function (obj, result, path, originObj) {
        if (!originObj) {
            var originObj = obj;
        }
        if (!path) {
            path = '';
        }

        if (_.isObject(obj) && !_.isArray(obj) && !_.isRegExp(obj) && !_.isFunction(obj)) {
            for (var value in obj) {

                if (_.isObject(obj[value]) && !_.isArray(obj[value]) && !_.isFunction(obj[value]) && !_.isRegExp(obj[value]) && !_.isDate(obj[value])) {
                    var subPath = _.isEmpty(path) ? value : path + '.' + value;
                    /*var subPath;

                     if (_.isEmpty(path)) {
                     subPath = value;
                     }
                     else {
                     if (/^-?[\d.]+(?:e-?\d+)?$/.test(value)) {
                     subPath = path + '["' + value + '"]';
                     }
                     else {
                     subPath = path + '.' + value;
                     }
                     }*/
                    result = walk(obj[value], result, subPath, originObj);
                }
                else {
                    if (_.isArray(obj[value])) {

                        for (var subObj in obj[value]) {



                            if (typeof obj[value][subObj] != "object") {
                                // Check if type object array or plain array
                                if (path) {
                                    result[path + '.' + value] = obj[value];
                                }
                                else {
                                    if (!result[value]) {
                                        result[value] = [];
                                    }
                                    result[value] = obj[value];
                                }
                            }
                            else {
                                if (obj[value][subObj][0] && !_.isObject(obj[value][subObj][0])) {
                                    if (!result[value]) {
                                        result[value] = [];
                                    }
                                    result[value][subObj] = obj[value][subObj];
                                }
                                else {
                                    if (path) {
                                        // Check if is Array or Object
                                        if (!_.isArray(obj[value])) {
                                            if (!result[path]) {
                                                result[path] = {};
                                            }
                                            if (!result[path][value]) {
                                                result[path][value] = {};
                                            }
                                            result[path][value][subObj] = plainValues(obj[value][subObj]);
                                        }
                                        else{
                                            if (!result[path]) {
                                                result[path] = {};
                                            }
                                            if (!result[path][value]) {
                                                result[path][value] = [];
                                            }
                                            result[path][value].push(plainValues(obj[value][subObj]));
                                        }
                                    }
                                    else {
                                        if (!result[value]) {
                                            result[value] = [];
                                        }
                                        result[value][subObj] = plainValues(obj[value][subObj]);
                                    }
                                }
                            }
                        }


                    }
                    else {
                        var pathName = path.replace('["', '.');
                        pathName = pathName.replace('"]', '');

                        if (path == '') {
                            try {
                                result[value] = eval('originObj' + generateObjectPath(value) + '');
                            } catch (e) {
                            }
                        }
                        else {
                            try {
                                result[pathName + '.' + value] = eval('originObj' + generateObjectPath(path) + '["' + value + '"]');
                            } catch (e) {
                            }
                        }
                    }
                }
            }
        }
        return result;
    };

    var resultArray = walk(obj, result);
    return _.isEmpty(resultArray) ? false : resultArray;
};

/**
 * Remove values where schema setting public.set false
 * @param values
 * @param schema
 * @returns {*}
 */
var unsetPublicSet = function (values, schema) {

    var publicList = find(schema, 'public')
        , arrElem;

    for (var value in values) {
        if (publicList[value]) {
            if (_.isArray(publicList[value])) {
                for (var thisArrayElem in publicList[value]) {

                    if (!_.isArray(values[value])) {
                        // Delete values due to it should be an array defined in schema
                        delete(values[value]);
                    }
                    else {
                        for (var thisValue in values[value]) {
                            values[value][thisValue] = unsetPublicSet(values[value][thisValue], publicList[value][thisArrayElem]);

                            if (_.isEmpty(values[value][thisValue])) {
                                (values[value]).splice(thisValue);
                            }
                        }

                        if (_.isEmpty(values[value])) {
                            delete(values[value]);
                        }
                    }
                }
            }
            else {
                if (publicList[value].public) {
                    if (publicList[value].public == false || (publicList[value].public.hasOwnProperty('set') && publicList[value].public.set != true)) {
                        delete(values[value]);
                    }
                }
            }
        }
    }
    return values;
};

/**
 * Apply virtual functions defined in schema
 * @param values
 * @param model
 * @param options
 * @returns {*}
 */
var setVirtuals = function (values, schema, options) {
    var virtualList = find(schema, 'virtual');

    //Set default value for virtual if not exists in values
    if (options && options.query === true) {
    }
    else {
        for (var virtual in virtualList) {

            if (_.isArray(virtualList[virtual])) {

                for (var thisVirtual in virtualList[virtual]) {

                    if (_.isArray(values[virtual])) {
                        for (var thisValue in values[virtual]) {
                            setVirtuals(values[virtual][thisValue], virtualList[virtual][thisVirtual], options);
                        }
                    }
                }
            }
            else {
                if (values[virtual] === undefined && virtualList[virtual] && virtualList[virtual].hasOwnProperty('default') && options && options.partial !== true) {
                    values[virtual] = (virtualList[virtual]).default;
                }
            }
        }
    }

    for (var value in values) {

        if (virtualList[value] && virtualList[value].virtual) {

            var setFunction = virtualList[value].virtual;

            //Check for setter and getter
            if (virtualList[value].virtual.set) {
                setFunction = virtualList[value].virtual.set;
            }

            //Check conditions and apply virtual
            rulesMatch(value, values[value], setFunction, null, function (err, data) {
                if (!err) {
                    if (_.isFunction(setFunction)) {
                        var virtualResult = setFunction(values[value]);
                        if (_.isObject(virtualResult) && !_.isEmpty(virtualResult)) {
                            //Check if virtual values does not exists in given values list. Do not overwrite given
                            for (var vValue in virtualResult) {
                                {
                                    if (vValue == 'this') {
                                        virtualResult[value] = virtualResult[vValue];
                                        delete(virtualResult[vValue]);
                                    }
                                    else {
                                        // Prevent overwrite of given values
                                        if (values[vValue] !== undefined) {
                                            delete(virtualResult[vValue]);
                                        }
                                    }
                                }
                            }
                            values = _.assign(values, virtualResult);
                        }
                    }
                }
            });
        }
    }
    return values;
};

/**
 * Compare given values with schema
 * @param values
 * @param schema
 * @param options
 * @param callback
 */
var modelCompare = function (values, schema, options, callback) {
    var newValues = {}
        , errors = []
        , modelList = find(schema)
        , val;

    for (var model in modelList) {
        if (_.isArray(modelList[model])) {

            if (values === undefined) {
                val = undefined;
            }
            else {
                val = values[model];
            }

            // Empty array defined in schema
            if (_.isEmpty(modelList[model])) {
                if (val) {
                    newValues[model] = val;
                }
            }
            else {
                // Set value to empty array if empty given
                if (val == undefined) {
                    if (options && options.partial == true) {
                        // Do nothing
                    }
                    else {
                        newValues[model] = [];
                    }
                }
                else {
                    // Sub model defined in schema
                    for (var thisSubSchema in modelList[model]) {
                        if (_.isArray(val)) {
                            for (var thisValue in val) {

                                // Check if type array or plain array
                                if (typeof val[thisValue] == "object") {
                                    modelCompare(val[thisValue], modelList[model][thisSubSchema], options, function (err, data) {
                                        if (err) {
                                            errors = _.union(errors, err);
                                        }
                                        if (data !== null) {
                                            if (!newValues[model]) {
                                                newValues[model] = [];
                                            }
                                            newValues[model][thisValue] = data;
                                        }
                                    });
                                }
                                else {
                                    rulesMatch(thisValue, val[thisValue], modelList[model][thisSubSchema], options, function (err, data) {
                                        if (err) {
                                            errors.push(err);
                                        }
                                        if (data !== undefined) {
                                            if (!newValues[model]) {
                                                newValues[model] = [];
                                            }
                                            newValues[model][thisValue] = data;
                                        }
                                    });
                                }
                            }
                        }
                        else {
                            modelCompare(val, modelList[model][thisSubSchema], options, function (err, data) {
                                if (err) {
                                    errors = _.union(errors, err);
                                }
                                if (data !== null) {
                                    newValues[model] = data;
                                }
                            });
                        }
                    }
                }
            }
        } else {
            // Check for definition of {} in model to allow any data for this node without validation
            if (_.isEmpty(modelList[model])) {
                for (var index in values) {
                    var filter = new RegExp("^" + model);
                    if (index.match(filter)) {
                        newValues[index] = values[index];
                    }
                }
            }
            else {
                if (values === undefined) {
                    val = undefined;
                }
                else {
                    val = values[model];
                }

                rulesMatch(model, val, modelList[model], options, function (err, data) {
                    if (err) {
                        errors.push(err);
                    }
                    if (data !== undefined) {
                        newValues[model] = data;
                    }
                });
            }
        }
    }

    if (_.isEmpty(errors)) {
        errors = null;
    }
    else {
        errors = {name: 'ValidationError', err: errors};
    }
    if (_.isEmpty(newValues)) {
        newValues = null;
    }
    callback(errors, newValues);
};

/**
 * Finds all nodes with filter property in given model and returns array list of nodes
 * @param model
 * @param filter
 * @returns {*}
 */
var findNodes = function (model, filter, value) {

    if (!_.isString(filter)) {
        return null;
    }

    if (model.data) {
        var list = findKeys(model.data, filter)
            , values = [];

        for (var res in list) {

            if (value === undefined || list[res][filter] === value) {
                values.push(res);
            }
        }
    }
    //return _.isEmpty(values) ? undefined : values;
    //Changed to return empty array instead of 'undefined'. Do not change back, otherwise some functions working with arrays do not work properly.
    return values;
};

/**
 * Extend schema by dynamic functions. Write a function that defined the schema settings for a node
 * @param schema
 * @returns {*}
 */
var addExtendSchemas = function (schema) {

    var extendList = find(schema, 'extend');
    for (var extendElem in extendList) {
        if (extendList[extendElem] && extendList[extendElem].extend && _.isFunction(extendList[extendElem].extend)) {
            schema[extendElem] = extendList[extendElem].extend();
        }
    }
    return schema;
}

/**
 * Validate values using a given model
 * @param values
 * @param model
 * @param goptions ,
 * flat = [true|false] => returns flat object list with "." notation,
 * query = [true|false] =
 * @param callback
 */
module.exports.validate = function (values, model, goptions, callback) {

    if (_.isFunction(goptions) && _.isEmpty(callback)) {
        callback = goptions;
    }
    var options = _.clone(goptions) || {};
    var schema = model.data
        , validatedValues;
    if (_.isObject(schema) && schema && !_.isEmpty(schema) && _.isObject(values)) {


        //Convert nested values to plain list
        values = unplainValues(values);
        values = plainValues(values);

        if (options && options.query === true) {
            // With option query do not set virtuals or unset values
        }
        else {
            // Unset values that are not allowed to set manually
            values = unsetPublicSet(values, model.data);
        }

        model.data = addExtendSchemas(model.data);

        // Apply virtual functions defined in model schema
        values = setVirtuals(values, model.data, options);

        //Compare vaules with model schema
        modelCompare(values, model.data, options, function (err, data) {

            if (err) {
                //TODO: Do not return data when development is finished. Just used for testing purpose
                callback(err, data);
            }
            else {
                if (data) {
                    if (options.flat == true) {
                        callback(err, data);
                    }
                    else {
                        validatedValues = unplainValues(data);
                        callback(err, validatedValues);
                    }
                }
                else {
                    callback({code: 'ModelNotMatch', msg: 'Model and given parameters does not match'});
                }
            }
        });
    }
    else {
        callback({code: 'InternalError', msg: 'Model or params not valid'});
    }
};

/**
 * Finds all nodes with filter property in given model and returns array list of nodes
 * @param model
 * @param filter i.e. 'unique'
 * @returns array
 */
module.exports.findNodes = function (model, filter, value) {
    values = findNodes(model, filter, value);
    return values;
};
