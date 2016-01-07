/**
 * Converts an error to plain objects. Since errors cannot be JSON.stringified
 * @param err
 * @returns {*}
 */
module.exports = function(err) {
    var plainObject = {};
    if (_.isObject(err)) {
        Object.getOwnPropertyNames(err).forEach(function (key) {
            plainObject[key] = err[key];
        });
        return plainObject;
    }
    else{
        return err;
    }

};

