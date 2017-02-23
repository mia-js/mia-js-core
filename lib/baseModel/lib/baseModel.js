/**
 *
 *
 */

var _ = require('lodash');
//base class
var Q = require('q');
var Shared = require("./../../shared");
var BaseClass = require("./../../baseClass");
var ModelValidator = require("./../../modelValidator");
var Utils = require("./../../utils");
var Qext = Utils.Qext;
var Logger = require('./../../logger');
var ArgumentHelpers = Utils.ArgumentHelpers;
var MemberHelpers = Utils.MemberHelpers;
var Async = require('async');

Q.stopUnhandledRejectionTracking();

function thisModule() {

    /**
     * Base class for all models
     */
    var baseModel = BaseClass.extend({},
        //==================================
        // Schema members
        //==================================
        {
            ensureSingleIndexes: function (callback) {
                var self = this;

                var deferred = Q.defer();
                callback = Qext.makeNodeResolver(deferred, callback);

                //get collection
                self.collection(function (err, collection) {
                    if (err) {
                        callback(err, collection);
                    }
                    else {
                        var indexNodesArray = ModelValidator.findNodes(self.prototype, 'index', true); //default: 'false'
                        var uniqueNodesArray = ModelValidator.findNodes(self.prototype, 'unique', true); //default: 'false'
                        var sparseNodesArray = ModelValidator.findNodes(self.prototype, 'sparse', true); //default: 'false'
                        var indexNodes = {};
                        var uniqueNodes = {};
                        var sparseNodes = {};

                        //convert arrays to dictionaries
                        _.forEach(indexNodesArray, function (path) {
                            indexNodes[path] = true;
                        });
                        _.forEach(uniqueNodesArray, function (path) {
                            uniqueNodes[path] = true;
                            if (!indexNodes[path]) {
                                //imply 'index' property to be 'true' for all nodes having 'unique' set to 'true'
                                indexNodes[path] = true;
                                indexNodesArray.push(path);
                            }
                        });
                        _.forEach(sparseNodesArray, function (path) {
                            sparseNodes[path] = true;
                        });

                        //call ensure index on all nodes having 'index' === 'true'
                        var paths, name = "", isUnique, isSparse;
                        Async.each(indexNodesArray, function (path, iterationCompleteCb) {
                            paths = {};
                            paths[path] = 1;
                            name = path.replace(/([^0-9a-z])/i, "");
                            isUnique = (uniqueNodes[path] === true);
                            isSparse = (sparseNodes[path] === true);
                            collection.createIndex(paths, {
                                name: name,
                                unique: isUnique,
                                sparse: isSparse
                            }, iterationCompleteCb);
                        }, callback);
                    }
                });

                return deferred.promise;
            },

            ensureCompoundIndexes: function (callback) {
                var self = this;

                var deferred = Q.defer();
                callback = Qext.makeNodeResolver(deferred, callback);

                var compoundIndexes = self.prototype.compoundIndexes;

                if (!compoundIndexes || compoundIndexes.length == 0) {
                    //nothing to do
                    callback();
                }
                else {
                    //get collection
                    self.collection(function (err, collection) {
                        if (err) {
                            callback(err, collection);
                        }
                        else {
                            //create compund indexes
                            var paths, isUnique, isSparse;
                            Async.each(compoundIndexes, function (compoundIndex, iterationCompleteCb) {
                                if (!compoundIndex.fields || compoundIndex.fields.length == 0) {
                                    //can't create empty index
                                    iterationCompleteCb();
                                }
                                else {
                                    paths = {};
                                    var name = "";
                                    _.forEach(compoundIndex.fields, function (path) {
                                        paths[path] = 1;
                                        name += path.replace(/([^0-9a-z])/i, "");
                                    });

                                    isUnique = (compoundIndex.unique === true);
                                    isSparse = (compoundIndex.sparse === true);
                                    collection.createIndex(paths, {
                                        name: compoundIndex.name || name,
                                        unique: isUnique,
                                        sparse: isSparse
                                    }, iterationCompleteCb);
                                }
                            }, callback);
                        }
                    });
                }

                return deferred.promise;
            },

            ensureTextIndexes: function (callback) {
                var self = this;

                var deferred = Q.defer();
                callback = Qext.makeNodeResolver(deferred, callback);

                var textIndexes = self.prototype.textIndexes;

                if (!textIndexes || textIndexes.length == 0) {
                    //nothing to do
                    callback();
                }
                else {
                    //get collection
                    self.collection(function (err, collection) {
                        if (err) {
                            callback(err, collection);
                        }
                        else {
                            //create compund indexes
                            var paths, isUnique, isSparse;
                            Async.each(textIndexes, function (textIndex, iterationCompleteCb) {
                                var name = "";
                                if (!textIndex.fields || textIndex.fields.length == 0) {
                                    //can't create empty index
                                    iterationCompleteCb();
                                }
                                else {
                                    paths = {};
                                    _.forEach(textIndex.fields, function (path) {
                                        paths[path] = "text";
                                        name += path.replace(/([^0-9a-z])/i, "");
                                    });

                                    isUnique = (textIndex.unique === true);
                                    isSparse = (textIndex.sparse === true);

                                    var options = {
                                        name: textIndex.name || name,
                                        unique: isUnique,
                                        sparse: isSparse
                                    };

                                    if (textIndex.default_language) {
                                        options["default_language"] = textIndex.default_language;
                                    }

                                    if (textIndex.weights) {
                                        options["weights"] = textIndex.weights;
                                    }

                                    collection.createIndex(paths, options, iterationCompleteCb);
                                }
                            }, callback);
                        }
                    });
                }

                return deferred.promise;
            },

            ensureAllIndexes: function (callback) {
                var self = this;
                return Q.all([
                    self.ensureSingleIndexes(),
                    self.ensureCompoundIndexes(),
                    self.ensureTextIndexes()
                ]).spread(function (singleIndexResult, compountIndexResult, textIndexResult) {
                    return Q(textIndexResult);
                }).nodeify(callback);
            },

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
                }
                else {
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
                        }
                        else {
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
            },

            /**
             * Gets mongo database
             * @returns {Promise containing database object OR error}
             */
            /*db: function (callback) {
             return Qext.callNodeFunc({
             obj: Shared.adapters("mongo2"),
             func: 'connect',
             callback: callback
             }, this.dbName);
             },*/

            db: function (dbName) {
                return Shared.dbconnection(dbName);
            },

            /**
             * Gets the collection of this model. Collection is specified in the 'collectionName' property of the model.
             */
            collection: function (callback) {
                var self = this;

                var deferred = Q.defer();
                callback = Qext.makeNodeResolver(deferred, callback);

                var breakExec = {};
                Async.waterfall([
                    function (next) {
                        if (!self.collectionName) {
                            next({
                                name: 'InternalError',
                                err: "collectionName property is not set for model " + self.identity
                            });
                        }
                        else {
                            var dbName = this.dbName || Shared.config("environment.defaultMongoDatabase");
                            var db = self.db(dbName);
                            if (db) {
                                next(null, db);
                            }
                            else {
                                next({
                                    name: 'InternalError',
                                    err: "No connection to database " + self.identity
                                });
                            }
                        }
                    },
                    function (db, next) {

                        if (!db || _.isEmpty(db)) {
                            Logger.error("No db connection");
                            next("No db connection");
                        }
                        else {
                            //try to get exiting collection
                            db.collection(self.collectionName, {strict: true}, function (err, collection) {
                                if (!err) {
                                    //collection exists already
                                    self._collection = collection;
                                    //do not apply indexes to exiting collection, since this operation is time consuming
                                    next(breakExec, collection);
                                }
                                else {
                                    var collectionOptions = self.collectionOptions || {};
                                    db.createCollection(self.collectionName, collectionOptions, function (err, collection) {
                                        if (!err) {
                                            next(null, collection);
                                        }
                                        else {
                                            db.collection(self.collectionName, {strict: true}, function (err, collection) {
                                                if (!err) {
                                                    //collection exists already
                                                    self._collection = collection;
                                                    //do not apply indexes to exiting collection, since this operation is time consuming
                                                    next(breakExec, collection);
                                                }
                                                else {
                                                    Logger.error(err);
                                                    next(err);
                                                }
                                            });
                                        }
                                    });
                                }
                            });
                        }
                    },
                    function (collection, next) {
                        //store new collection
                        self._collection = collection;
                        //apply all indexes on collection
                        self.ensureAllIndexes(function (err) {
                            next(err, collection);
                        });
                    },
                    function (collection, next) {
                        //return collection
                        next(null, collection);
                    }
                ], function (err, collection) {
                    if (!err || err === breakExec) {
                        callback(null, collection);
                    }
                    else {
                        callback(err);
                    }
                });

                return deferred.promise;
            },

            _callGeneric: function (functionName, args) {
                var argData = ArgumentHelpers.prepareCallback(args);

                var callback = argData.callback;
                var args = argData.arguments;
                if (callback) {
                    args.pop();
                }

                return this.collection().then(function (collection) {
                    var deferred = Q.defer();
                    args.push(Qext.makeNodeResolver(deferred));
                    collection[functionName].apply(collection, args);
                    return deferred.promise;
                }).nodeify(callback);
            },

            /**
             * Same signature as in native mongo driver. Inserts a single document or a an array of documents into MongoDB. Validates documents before inserting them
             *
             * insert(docs[, options][, callback])
             *
             * Options
             *  - **w**, {Number/String, > -1 || 'majority' || tag name} the write concern for the operation where < 1 is no acknowlegement of write and w >= 1, w = 'majority' or tag acknowledges the write
             *  - **wtimeout**, {Number, 0} set the timeout for waiting for write concern to finish (combines with w option)
             *  - **fsync**, (Boolean, default:false) write waits for fsync before returning
             *  - **journal**, (Boolean, default:false) write waits for journal sync before returning
             *  - **continueOnError/keepGoing** {Boolean, default:false}, keep inserting documents even if one document has an error, *mongodb 1.9.1 >*.
             *  - **serializeFunctions** {Boolean, default:false}, serialize functions on the document.
             *  - **forceServerObjectId** {Boolean, default:false}, let server assign ObjectId instead of the driver
             *  - **validate**, data validation according to schema. If not specified is set to 'true', on explicit 'false' validation is skipped.
             *
             * Deprecated Options
             *  - **safe** {true | {w:n, wtimeout:n} | {fsync:true}, default:false}, executes with a getLastError command returning the results of the command on MongoDB.
             *
             * @param {Array|Object} docs
             * @param {Object} [options] optional options for insert command
             * @param {Function} [callback] optional callback for the function, must be provided when using a writeconcern
             * @return {null}
             * @api public
             */

            insertOne: function () {
                return this._callGeneric('insertOne', arguments);
            },

            updateOne: function () {
                return this._callGeneric('updateOne', arguments);
            },

            aggregate: function () {
                return this._callGeneric('aggregate', arguments);
            },
            bulkWrite: function () {
                return this._callGeneric('bulkWrite', arguments);
            },
            count: function () {
                return this._callGeneric('count', arguments);
            },
            createIndex: function () {
                return this._callGeneric('createIndex', arguments);
            },
            deleteMany: function () {
                return this._callGeneric('deleteMany', arguments);
            },
            deleteOne: function () {
                return this._callGeneric('deleteOne', arguments);
            },
            distinct: function () {
                return this._callGeneric('distinct', arguments);
            },
            drop: function () {
                return this._callGeneric('drop', arguments);
            },
            dropIndex: function () {
                return this._callGeneric('dropIndex', arguments);
            },
            find: function () {
                return this._callGeneric('find', arguments);
            },
            findOne: function () {
                return this._callGeneric('findOne', arguments);
            },
            findOneAndDelete: function () {
                return this._callGeneric('findOneAndDelete', arguments);
            },
            findOneAndReplace: function () {
                return this._callGeneric('findOneAndReplace', arguments);
            },
            findOneAndUpdate: function () {
                return this._callGeneric('findOneAndUpdate', arguments);
            },
            geoHaystackSearch: function () {
                return this._callGeneric('geoHaystackSearch', arguments);
            },
            geoNear: function () {
                return this._callGeneric('geoNear', arguments);
            },
            group: function () {
                return this._callGeneric('group', arguments);
            },
            indexes: function () {
                return this._callGeneric('indexes', arguments);
            },
            indexExists: function () {
                return this._callGeneric('indexExists', arguments);
            },
            indexInformation: function () {
                return this._callGeneric('indexInformation', arguments);
            },
            initializeOrderedBulkOp: function () {
                return this._callGeneric('initializeOrderedBulkOp', arguments);
            },
            initializeUnorderedBulkOp: function () {
                return this._callGeneric('initializeUnorderedBulkOp', arguments);
            },
            insertMany: function () {
                return this._callGeneric('insertMany', arguments);
            },
            /*insertOne: function () {
             return this._callGeneric('insertOne', arguments);
             },*/
            isCapped: function () {
                return this._callGeneric('isCapped', arguments);
            },
            listIndexes: function () {
                return this._callGeneric('listIndexes', arguments);
            },
            mapReduce: function () {
                return this._callGeneric('mapReduce', arguments);
            },
            options: function () {
                return this._callGeneric('options', arguments);
            },
            parallelCollectionScan: function () {
                return this._callGeneric('parallelCollectionScan', arguments);
            },
            reIndex: function () {
                return this._callGeneric('reIndex', arguments);
            },
            removeOne: function () {
                return this._callGeneric('removeOne', arguments);
            },
            removeMany: function () {
                return this._callGeneric('removeMany', arguments);
            },
            rename: function () {
                return this._callGeneric('rename', arguments);
            },
            save: function () {
                return this._callGeneric('save', arguments);
            },
            stats: function () {
                return this._callGeneric('stats', arguments);
            },
            updateMany: function () {
                return this._callGeneric('updateMany', arguments);
            },
            /*updateOne: function () {
             return this._callGeneric('updateOne', arguments);
             }*/

        });

    return baseModel;
};

module.exports = thisModule();