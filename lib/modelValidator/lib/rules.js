var _ = require('lodash');

/**
 * Minlength check
 * @param min
 * @param value
 * @returns {boolean}
 */
exports.minLength = function (min, value) {
    if (_.isNumber(min)) {
        return !_.isUndefined(value) && value.length < min ? false : true;
    }
    else {
        return false;
    }
};


/**
 * MaxLength check
 * @param max
 * @param value
 * @returns {boolean}
 */
exports.maxLength = function (max, value) {
    if (_.isNumber(max)) {
        return !_.isUndefined(value) && value.length > max ? false : true;
    }
    else {
        return false;
    }
};

/**
 * Pattern match check, use regex
 * @param pattern
 * @param value
 * @returns {boolean}
 */
exports.match = function (pattern, value) {
    return pattern.test(value);
};


exports.min = function (min, value) {
    return !_.isUndefined(value) && _.isNumber(min) && value < min ? false : true;
};

exports.max = function (max, value) {
    return !_.isUndefined(value) && _.isNumber(max) && value > max ? false : true;
};

exports.allow = function (allow, value) {

    var status = false;

    if (!_.isArray(allow)) {
        allow = [allow];
    }
    _.forEach(allow, function (val) {
        if (typeof(value) == 'string') {
            value = value.toLowerCase();
        }

        if (typeof(val) == 'string') {
            val = val.toLowerCase();
        }

        if (value && val == value) {
            status = true;
        }
    });
    return status;
};

exports.deny = function (deny, value) {

    var status = true;

    if (!_.isArray(deny)) {
        deny = [deny];
    }

    _.forEach(deny, function (val) {

        if (typeof(value) == 'string') {
            value = value.toLowerCase();
        }

        if (typeof(val) == 'string') {
            val = val.toLowerCase();
        }

        if (value && val == value) {
            status = false;
        }
    });
    return status;

};

/**
 * Variable type check
 * @param type
 * @param value
 * @returns {boolean}
 */
exports.checkType = function (type, value) {

    if (_.isString(type)) {
        type = type.toLowerCase();
    }

    //Check if string
    if (type == 'string') {
        if (typeof(value) == 'string') {
            return value;
        }
        else {
            //Convert to string if number or boolean
            if (typeof(value) == 'number' || typeof(value) == 'boolean') {
                return String(value);
            }
        }
    }

    //Check if array
    if (type == 'array') {
        if (_.isArray(value)) {
            return value;
        }
    }

    //Check if boolean
    if (type == 'boolean') {
        if (typeof(value) == 'boolean') {
            return value;
        }
        else {
            if (typeof(value) == 'string') {
                if (value.toLowerCase() == 'true') {
                    return true;
                }
                if (value.toLowerCase() == 'false') {
                    return false;
                }
            }
        }
    }

//Check if number
    if (type == 'number') {
        if (typeof(value) == 'number') {
            return value;
        }
        else {
            //Check if value is number
            if (!isNaN(value)) {
                return parseFloat(value);
            }
        }
    }


//Check if date
    if (type == 'date') {
        if (value instanceof Date) {
            return value;
        }

        var date = new Date(value);
        if (date != 'Invalid Date') {
            return value;
        }
    }

    if (type == 'timestamp') {
        if (value.length == 10 && value.match(/^[0123456789]+$/)) {
            var date = new Date(parseInt(value) * 1000);
            if (date != 'Invalid Date') {
                return parseInt(value);
            }
        }
    }

    // Check if CIDR i.e. 192.168.0.1/32 or 2001:db8:0:8d3:0:8a2e:70:7344
    if (type == 'cidr') {
        // Valid ipv4 cidr
        if (_.isString(value) && /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\/([0-9]|((3[0-2])|(0[0-2][0-9])))$/i.test(value)) {
            return value;
        }

        // Valid ipv6 cidr
        if (_.isString(value) && /^s*((([0-9A-Fa-f]{1,4}:){7}([0-9A-Fa-f]{1,4}|:))|(([0-9A-Fa-f]{1,4}:){6}(:[0-9A-Fa-f]{1,4}|((25[0-5]|2[0-4]d|1dd|[1-9]?d)(.(25[0-5]|2[0-4]d|1dd|[1-9]?d)){3})|:))|(([0-9A-Fa-f]{1,4}:){5}(((:[0-9A-Fa-f]{1,4}){1,2})|:((25[0-5]|2[0-4]d|1dd|[1-9]?d)(.(25[0-5]|2[0-4]d|1dd|[1-9]?d)){3})|:))|(([0-9A-Fa-f]{1,4}:){4}(((:[0-9A-Fa-f]{1,4}){1,3})|((:[0-9A-Fa-f]{1,4})?:((25[0-5]|2[0-4]d|1dd|[1-9]?d)(.(25[0-5]|2[0-4]d|1dd|[1-9]?d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){3}(((:[0-9A-Fa-f]{1,4}){1,4})|((:[0-9A-Fa-f]{1,4}){0,2}:((25[0-5]|2[0-4]d|1dd|[1-9]?d)(.(25[0-5]|2[0-4]d|1dd|[1-9]?d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){2}(((:[0-9A-Fa-f]{1,4}){1,5})|((:[0-9A-Fa-f]{1,4}){0,3}:((25[0-5]|2[0-4]d|1dd|[1-9]?d)(.(25[0-5]|2[0-4]d|1dd|[1-9]?d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){1}(((:[0-9A-Fa-f]{1,4}){1,6})|((:[0-9A-Fa-f]{1,4}){0,4}:((25[0-5]|2[0-4]d|1dd|[1-9]?d)(.(25[0-5]|2[0-4]d|1dd|[1-9]?d)){3}))|:))|(:(((:[0-9A-Fa-f]{1,4}){1,7})|((:[0-9A-Fa-f]{1,4}){0,5}:((25[0-5]|2[0-4]d|1dd|[1-9]?d)(.(25[0-5]|2[0-4]d|1dd|[1-9]?d)){3}))|:)))(%.+)?s*/.test(value)) {
            return value;
        }
    }

    // Check if IP i.e. 192.168.0.1 or 2001:db8:0:8d3:0:8a2e:70:7344
    if (type == 'ip') {
        //Valid ipv4
        if (_.isString(value) && /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/i.test(value)) {
            return value;
        }

        //Valid ipv6
        if (_.isString(value) && /(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))/i.test(value)) {
            return value;
        }
    }

    // Check if CIDR i.e. 2001:db8:0:8d3:0:8a2e:70:7344
    if (type == 'cidrv6') {
        // Valid ipv6 cidr
        if (_.isString(value) && /^s*((([0-9A-Fa-f]{1,4}:){7}([0-9A-Fa-f]{1,4}|:))|(([0-9A-Fa-f]{1,4}:){6}(:[0-9A-Fa-f]{1,4}|((25[0-5]|2[0-4]d|1dd|[1-9]?d)(.(25[0-5]|2[0-4]d|1dd|[1-9]?d)){3})|:))|(([0-9A-Fa-f]{1,4}:){5}(((:[0-9A-Fa-f]{1,4}){1,2})|:((25[0-5]|2[0-4]d|1dd|[1-9]?d)(.(25[0-5]|2[0-4]d|1dd|[1-9]?d)){3})|:))|(([0-9A-Fa-f]{1,4}:){4}(((:[0-9A-Fa-f]{1,4}){1,3})|((:[0-9A-Fa-f]{1,4})?:((25[0-5]|2[0-4]d|1dd|[1-9]?d)(.(25[0-5]|2[0-4]d|1dd|[1-9]?d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){3}(((:[0-9A-Fa-f]{1,4}){1,4})|((:[0-9A-Fa-f]{1,4}){0,2}:((25[0-5]|2[0-4]d|1dd|[1-9]?d)(.(25[0-5]|2[0-4]d|1dd|[1-9]?d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){2}(((:[0-9A-Fa-f]{1,4}){1,5})|((:[0-9A-Fa-f]{1,4}){0,3}:((25[0-5]|2[0-4]d|1dd|[1-9]?d)(.(25[0-5]|2[0-4]d|1dd|[1-9]?d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){1}(((:[0-9A-Fa-f]{1,4}){1,6})|((:[0-9A-Fa-f]{1,4}){0,4}:((25[0-5]|2[0-4]d|1dd|[1-9]?d)(.(25[0-5]|2[0-4]d|1dd|[1-9]?d)){3}))|:))|(:(((:[0-9A-Fa-f]{1,4}){1,7})|((:[0-9A-Fa-f]{1,4}){0,5}:((25[0-5]|2[0-4]d|1dd|[1-9]?d)(.(25[0-5]|2[0-4]d|1dd|[1-9]?d)){3}))|:)))(%.+)?s*/.test(value)) {
            return value;
        }
    }

    // Check if CIDR i.e. 192.168.0.1/32
    if (type == 'cidrv4') {
        // Valid ipv4 cidr
        if (_.isString(value) && /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\/([0-9]|((3[0-2])|(0[0-2][0-9])))$/i.test(value)) {
            return value;
        }
    }

    // Check if IP i.e. 192.168.0.1
    if (type == 'ipv4') {
        //Valid ipv4
        if (_.isString(value) && /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/i.test(value)) {
            return value;
        }
    }

    // Check if IP 2001:db8:0:8d3:0:8a2e:70:7344
    if (type == 'ipv6') {
        //Valid ipv6
        if (_.isString(value) && /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/i.test(value)) {
            return value;
        }
    }

    return undefined;
};