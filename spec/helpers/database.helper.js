var Q = require('q');
var Shared = require('../../lib/shared');
var MongoAdapter = require('../../lib/dbAdapters').MongoAdapter;

jasmine.database = {
    adapter: null,
    dbName: null,
    db: null,
    _init: function () {
        // Initialize config
        Shared.initializeConfig('spec/config', 'test');
        // Set database name
        this.dbName = Shared.config('environment').defaultMongoDatabase;
        // Create new MongoDB adapter
        this.adapter = new MongoAdapter();
    },
    connect: function () {
        if (!this.adapter) {
            this._init();
        }
        return this.adapter.connect(this.dbName)
            .then(function (db) {
                this.db = db;
                return db;
            });
    },
    close: function () {
        if (!this.db) {
            return Q();
        }
        return this.adapter.close(this.dbName, this.db);
    },
    drop: function () {
        if (!this.db) {
            this.connect();
        }
        var deferred = Q.defer();
        return this.db.dropDatabase(function (error, result) {
            if (error) {
                return deferred.reject(error);
            }
            return deferred.resolve(result);
        });
    }
};
