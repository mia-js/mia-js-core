var _ = require('lodash');
var Q = require('q');
var BaseClass = require("./../../baseClass");
var ModelValidator = require("./../../modelValidator");
var Utils = require("./../../utils");
var Qext = Utils.Qext;
var ArgumentHelpers = Utils.ArgumentHelpers;

Q.stopUnhandledRejectionTracking();

function thisModule() {
    var embedModel = BaseClass.extend({},
        //==================================
        // Schema members
        //==================================
        {
            /**
             * Validates provided 'values' against this model.
             * @param values
             * @param callback
             */
            validate: function (values, options, callback) {
                var deferred = Q.defer();
                var args = ArgumentHelpers.prepareArguments(options, callback)
                    , wrapper = {};
                options = args.options;
                callback = Qext.makeNodeResolver(deferred, args.callback);

                //Check for mongo's another possible syntax with '$' operators, e.g. '$set', '$setOnInsert' and set wrapper
                values = values || {};

                for (var element in values) {
                    if (element.match(/\$/i)) {
                        wrapper[element] = values[element];
                        options.flat = options.flat != undefined ? options.flat : true
                    }
                }

                // If nothing to wrap just validate values
                if (_.isEmpty(wrapper)) {
                    ModelValidator.validate(values, this.prototype, options, function (err, validatedValues) {
                        callback(err, validatedValues);
                    });
                } else {
                    // If wrapping elements like $set, $inc etc found, validate each and rewrite to values
                    values = {};
                    var errors = {};
                    var wrapperOptions = {};
                    for (var wrapperElem in wrapper) {

                        wrapperOptions = _.clone(options);
                        if (options && options.partial && _.isObject(options.partial)) {
                            if (options.partial[wrapperElem] !== undefined) {
                                wrapperOptions['partial'] = options.partial[wrapperElem];
                            }
                        }

                        if (options && options.validate && _.isObject(options.validate)) {
                            if (options.validate[wrapperElem] !== undefined) {
                                wrapperOptions['validate'] = options.validate[wrapperElem];
                            }
                        }

                        if (options.validate && options.validate[wrapperElem] === false) {
                            values[wrapperElem] = wrapper[wrapperElem];
                        } else {
                            ModelValidator.validate(wrapper[wrapperElem], this.prototype, wrapperOptions, function (err, validatedValues) {
                                if (err) {
                                    errors = err;
                                }
                                values[wrapperElem] = validatedValues;
                            });
                        }
                    }

                    if (_.isEmpty(errors)) {
                        errors = null;
                    }
                    callback(errors, values);
                }

                return deferred.promise;
            }
        });

    return embedModel;
};

module.exports = thisModule();
