var _ = require('lodash');

/**
 * Split query params by ',' for multiple values
 * @returns {Function}
 */

var parse = function (query) {
    if (_.isObject(query)) {
        for (var param in query) {
            query[param] = (query[param]).split(',');
        }
    }
    else {
        query = (query).split(',');
    }
    return query;
};

module.exports = parse;