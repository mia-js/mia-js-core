/**
 * Convert values to specified format
 * @param schema
 * @param value
 * @returns {*}
 */
exports.convertValue = function (schema, value) {

    //Convert string using convert setting
    if (typeof(value) == 'string') {
        if (schema.hasOwnProperty('convert')) {

            if (!_.isArray(schema.convert)) {
                schema.convert = [schema.convert];
            }

            _.forEach(schema.convert, function (convertValue) {
                //Convert to lowerCase
                if (convertValue == 'lower') {
                    value = value.toLowerCase();
                }
                //Convert to upperCase
                if (convertValue == 'upper') {
                    value = value.toUpperCase();
                }
                //Remove spaces
                if (convertValue == 'trim') {
                    value = value.replace(/^\s+|\s+$/g,'');
                }

            });
        }
    }

    if (schema.hasOwnProperty('type')) {
        var type;
        if (_.isString(schema.type)) {
            type = schema.type.toLowerCase();

            if (type == 'date') {
                var date = new Date(value);
                if (date != 'Invalid Date') {
                    value = date;
                }
            }
        }
    }
    return value;
};