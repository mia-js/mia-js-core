/**
 *  Adapter for mongoDB
 */

var Async = require('async');
var Utils = require('./../../utils');
var Shared = require("./../../shared");
var Logger = require('./../../logger');
var Q = require('q');
var EventEmitter = require('events').EventEmitter;
var MongoClient = require('mongodb').MongoClient;

Q.stopUnhandledRejectionTracking();

module.exports = function () {
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

    var _connect = function (dbName, url, options) {
        var deferred = Q.defer();
        MongoClient.connect(url, options, function (err, db) {
            if (err) {
                Logger.error("Could not connect to database '" + dbName + "'. Extended error information: " + err);
                deferred.reject(err);
            }
            else {
                Logger.info("Connected to database '" + dbName+"'");
                Shared.registerDbConnection(dbName,db);
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