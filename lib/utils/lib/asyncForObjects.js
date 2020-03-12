var Async = require('async');
var _ = require('lodash');
var MiaError = require('../../errorHandler/lib/error');

function thisModule() {
    var self = this;

    var _objectToArray = function (obj) {

        var isPlainObject = _.isPlainObject;

        if (_.isArray(obj)) {
            return obj;
        }
        else if (_.isPlainObject(obj)) {
            //convert object to array
            var array = [];
            for (var prop in obj) {
                if (obj.hasOwnProperty(prop)) {
                    array.push(obj[prop]);
                }
            }
            return array;
        }
        else {
            throw new MiaError("Array or plain object is expected!");
        }
    };

    self.each = function (obj, iterator, callback) {
        var array;
        try {
            array = _objectToArray(obj);
        }
        catch (err) {
            callback(err);
            return;
        }
        Async.each(array, iterator, callback);
    };

    self.eachSeries = function (obj, iterator, callback) {
        var array;
        try {
            array = _objectToArray(obj);
        }
        catch (err) {
            callback(err);
            return;
        }
        Async.eachSeries(array, iterator, callback);
    };

    return self;
};

module.exports = new thisModule();