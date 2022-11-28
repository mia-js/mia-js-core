/**
 *  Adapter for mongoDB
 */

var Q = require('q');
var _ = require("lodash");
var MongoClient = require('mongodb').MongoClient;
var MiaError = require('../../errorHandler/lib/error');

Q.stopUnhandledRejectionTracking();

module.exports = function () {
    var Shared = require("./../../shared");
    var Logger = require('./../../logger');
    var self = this;

    var _requiredSetting = function (dbName, settingSubpath) {
        return _getSetting(dbName, settingSubpath, true);
    };

    var _optionalSetting = function (dbName, settingSubpath) {
        return _getSetting(dbName, settingSubpath, false);
    };

    var _getSetting = function (dbName, settingSubpath, isRequired) {
        if (!String.isEmpty(settingSubpath)) {
            settingSubpath = '.' + settingSubpath;
        }
        var settingPath = 'environment.mongoDatabases.' + dbName + settingSubpath;
        var settingValue = Shared.config(settingPath);
        if (isRequired && !settingValue) {
            throw new MiaError("Setting " + settingPath + " is missing for mongo database '" + dbName);
        }
        else {
            return settingValue;
        }
    };

    // Connect to mongodb as single host or repliset
    self.connect = function (dbName) {
        var options = _optionalSetting(dbName, "options") || {};
        var url = _requiredSetting(dbName, "url");
        return _connect(dbName, url, options);
    };

    var _connect = function (dbId, url, options) {
        var deferred = Q.defer();
        MongoClient.connect(url, options, function (err, client) {
            if (err) {
                Logger.error("Could not connect to database with identifier '" + dbId + "'. Extended error information: " + err);
                deferred.reject(new MiaError(err));
            } else {
                var dbName = client['s']['options']['dbName'] || dbId;
                var db = client.db(dbName);
                Logger.info("Connected to database with identifier '" + dbId + "' (database name is " + dbName + ")");
                Shared.registerDbConnection(dbId, db, client);
                deferred.resolve(db);
            }
        });
        return deferred.promise;
    };

    // Close db connection
    self.close = function (dbName, client) {
        var deferred = Q.defer();
        client.close(function (err, done) {
            if (err) {
                Logger.error("Could not close connect to database '" + dbName + "'. Extended error information: " + err);
                deferred.reject(new MiaError(err));
            }
            else {
                deferred.resolve(done);
            }
        });
        return deferred.promise;
    };

    self.creationOfNewCollectionsMethod = () => {
        const level = _.get(Shared.config('environment'), 'creationOfNewCollectionsMethod', 'strict');
        if (['strict', 'warn', 'none'].includes(String(level).toLowerCase())) {
            return level
        }
        return 'strict'
    }

    const _skipDatabaseIndexingOnNewCollections = () => {
        const shouldSkip = _.get(Shared.config('environment'), 'skipDatabaseIndexingOnNewCollections', false);
        return ['true', '1', 'y', 'yes', 'on'].includes(String(shouldSkip).toLowerCase());
    }

    const _ensureIndexes = Model => {
        const deferred = Q.defer()
        Model.ensureAllIndexes(error => {
            if (error) {
                return deferred.reject(new MiaError(error))
            }
            return deferred.resolve()
        }, false) // because this is during server start, we create indexes in foreground with full force
        return deferred.promise
    }

    self.createNewCollections = async () => {

        const models = Shared.models()
        const collectionsIndexedByDBName = {}
        let cnt = 0

        Logger.info('Checking for new database models')

        for (const identity in models) {
            if (!Object.prototype.hasOwnProperty.call(models, identity)) continue
            const versions = models[identity]

            for (const version in versions) {
                if (!Object.prototype.hasOwnProperty.call(versions, version)) continue
                const Model = versions[version]
                const dbName = Model.dbName || Shared.config('environment.defaultMongoDatabase')

                if (Model.disabled) continue

                if (!collectionsIndexedByDBName[dbName]) {
                    /**
                     * Get all collections from specific database and store them to a map, so we do listCollections()
                     * only once for every database
                     */
                    await Q(Model.db(dbName).listCollections({}, {nameOnly: true}))
                        .then(cursor => cursor.toArray())
                        .then(collections => {
                            collectionsIndexedByDBName[dbName] = collections
                        })
                }
                const collection = _.find(collectionsIndexedByDBName[dbName], ['name', Model.collectionName])
                if (!collection) {
                    const collectionOptions = Model.collectionOptions || {}
                    cnt += 1

                    await Model.db(dbName).createCollection(Model.collectionName, collectionOptions)
                        .then(async () => {
                            Logger.info(`Collection ${dbName}.${Model.collectionName} created successfully`)

                            if (!_skipDatabaseIndexingOnNewCollections()) {
                                await _ensureIndexes(Model)
                                    .then(() => Logger.info(`All indexes on ${dbName}.${Model.collectionName} applied successfully`))
                                    .catch(error => {
                                        Logger.warn(`There was an error applying indexes on collection ${dbName}.${Model.collectionName}:`)
                                        if (_creationOfNewCollectionsMethod() === 'strict') {
                                            return Q.reject(error)
                                        } else {
                                            Logger.warn(error)
                                        }
                                    })
                            }
                        })
                        .catch(error => {
                            Logger.warn(`There was an error creating collection ${dbName}.${Model.collectionName}:`)
                            if (_creationOfNewCollectionsMethod() === 'strict') {
                                return Q.reject(error)
                            } else {
                                Logger.warn(error)
                            }
                        })
                }
            }
        }

        if (cnt === 0) {
            Logger.info('No new database models found')
        }

        return Q()
    }

    return self;
};