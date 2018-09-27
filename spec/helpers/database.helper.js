var Q = require('q');
var Shared = require('../../lib/shared');
var MongoAdapter = require('../../lib/dbAdapters').MongoAdapter;

function thisModule() {
    var self = this;
    self.adapter = null;
    self.dbName = null;
    self.db = null;

    var _init = function () {
        // Initialize config
        Shared.initializeConfig('/spec/config', 'test');
        // Set database name
        self.dbName = Shared.config('environment').defaultMongoDatabase;
        // Create new MongoDB adapter
        self.adapter = new MongoAdapter();
    };

    self.connect = function () {
        if (!this.adapter) {
            _init();
        }
        return self.adapter.connect(self.dbName)
            .then(function (db) {
                self.db = db;
                return db;
            });
    };

    self.close = function () {
        if (!self.db) {
            return Q();
        }
        var dbConnection = Shared.dbconnection(self.dbName);
        return self.adapter.close(self.dbName, dbConnection["client"]);
    };

    self.drop = function () {
        if (!self.db) {
            self.connect();
        }
        var deferred = Q.defer();
        self.db.dropDatabase(function (error, result) {
            if (error) {
                return deferred.reject(error);
            }
            return deferred.resolve(result);
        });
        return deferred.promise;
    };

    return self;
}

jasmine.database = new thisModule();
