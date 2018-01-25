/**
 *  Adapter for mongoDB
 */

var Q = require('q');
var MongoClient = require('mongodb').MongoClient;

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
            throw new Error("Setting " + settingPath + " is missing for mongo database '" + dbName);
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
                deferred.reject(err);
            } else {
                var dbName = client['s']['options']['dbName'] || dbId;
                var db = client.db(dbName);
                Logger.info("Connected to database with identifier '" + dbId + "' (database name is " + dbName + ")");
                Shared.registerDbConnection(dbId, db);
                deferred.resolve(db);
            }
        });
        return deferred.promise;
    };


    // Close db connection
    self.close = function (dbName, db) {
        return _close(dbName, db);
    };

    var _close = function (dbName, db) {
        var deferred = Q.defer();
        db.close(function (err, done) {
            if (err) {
                Logger.error("Could not close connect to database '" + dbName + "'. Extended error information: " + err);
                deferred.reject(err);
            }
            else {
                deferred.resolve(done);
            }
        });
        return deferred.promise;
    };

    return self;
};