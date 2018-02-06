var Q = require('q');
var _ = require('lodash');
var ObjectID = require('../../dbAdapters').MongoObjectID;
var Shared = require('../../shared');

describe("baseModel", function () {

    describe("Derived model", function () {
        var pathToModule = "./data/testModel.js";
        var Model = require(pathToModule);
        var modelInstance;

        it("must be available at '" + pathToModule + "'", function (next) {
            expect(Model).toBeDefined();
            next();
        });

        it("must be instantiable", function (next) {
            expect(function () {
                modelInstance = new Model();
            }).not.toThrow();
            next();
        });

        describe("Instance", function () {
            it("must reference to its schema", function (next) {
                expect(modelInstance.schema).toEqual(Model);
                next();
            });
        });

        describe("Testing model/instance db methods:", function () {

            beforeAll(function (next) {
                jasmine.database.connect()
                    .then(jasmine.database.drop)
                    .then(next);
            });
            afterAll(function (next) {
                jasmine.database.close()
                    .then(next);
            });

            describe("Getting collection", function () {
                var collection;
                var collection1;
                var collection2;

                beforeEach(function (next) {
                    expect(function () {
                        Model.collection(function (error, coll) {
                            collection = coll;
                            expect(error).toBeNull();
                            expect(collection).toBeDefined();
                            next();
                        });
                    }).not.toThrow();
                });

                it("must return collection on first call", function (next) {
                    collection1 = collection;
                    next();
                });

                it("must return the same collection on second call", function (next) {
                    collection2 = collection;
                    expect(collection1.name).toEqual(collection2.name);
                    next();
                });
            });

            describe("Dropping collection", function () {
                it("must work", function (next) {
                    expect(function () {
                        Model.drop(function (error, result) {
                            expect(error).toBeNull();
                            expect(result).toBeTruthy();
                            next();
                        });
                    }).not.toThrow();
                });
            });

            describe("Creating/ensuring indexes", function () {
                it("must work", function (next) {
                    expect(function () {
                        Model.ensureAllIndexes(function (error) {
                            expect(error).toBeNull();
                            next();
                        });
                    }).not.toThrow();
                });
            });

            describe("Inserting objects", function () {
                it("inserting arbitrary document", function (next) {
                    expect(function () {
                        modelInstance.schema.insertOne({'hello': 'doc1'}, {validate: false}, function (error, result) {
                            expect(error).toBeNull();
                            next();
                        });
                    }).not.toThrow();
                });

                it("inserting and validating document with schema's 'insert' function", function (next) {
                    expect(function () {
                        var values = {};
                        values.userId = '4';
                        values['culture'] = {};
                        values['culture']['language'] = 'de';
                        values['culture']['region'] = 'ca';
                        values['culture']['code'] = 'de-de';
                        values['appversion'] = 19;

                        Model.insertOne(values, function (error, result) {
                            expect(error).toBeNull();
                            next();
                        });
                    }).not.toThrow();
                });

                it("inserting document with id === null (unique, sparse)", function (next) {
                    expect(function () {
                        var values = {};
                        //values.userId = null;
                        values['culture'] = {};
                        values['culture']['language'] = 'de';
                        values['culture']['region'] = 'ca';
                        values['culture']['code'] = 'de-at';
                        values['appversion'] = 19;

                        Model.insertOne(values, function (error, result) {
                            expect(error).toBeNull();
                            next();
                        });
                    }).not.toThrow();
                });

                it("inserting document with id === null (unique, sparse)", function (next) {
                    expect(function () {
                        var values = {};
                        //values.userId = null;
                        values['culture'] = {};
                        values['culture']['language'] = 'de';
                        values['culture']['region'] = 'ca';
                        values['culture']['code'] = 'de-de';
                        values['appversion'] = 3;

                        Model.insertOne(values, function (error, result) {
                            expect(error).toBeDefined();
                            next();
                        });
                    }).not.toThrow();
                });

                it("updating and validating document with schema's 'update' function", function (next) {
                    expect(function () {
                        var values = {};
                        values.userId = '5';
                        values['culture'] = {};
                        values['culture']['language'] = 'ef';
                        values['culture']['region'] = 'ca';
                        values['culture']['code'] = 'de-de';
                        values['appversion'] = 19;

                        Model.updateOne({userId: values.userId}, {$set: values}, function (error, result) {
                            expect(error).toBeNull();
                            next();
                        });
                    }).not.toThrow();
                });

                it("findOne", function (next) {
                    expect(function () {
                        Model.findOne({'hello': 'doc1'}, function (error, doc) {
                            expect(error).toBeNull();
                            next();
                        });
                    }).not.toThrow();
                });

                it("count all", function (next) {
                    expect(function () {
                        Model.count(function (error, count) {
                            expect(error).toBeNull();
                            next();
                        });
                    }).not.toThrow();
                });

                it("count with query", function (next) {
                    expect(function () {
                        Model.count({'hello': 'doc1'}, function (error, count) {
                            expect(error).toBeNull();
                            next();
                        });
                    }).not.toThrow();
                });
            });

            describe("Quering db: 'find'", function () {
                it("must work", function (next) {
                    expect(function () {
                        Model.find({'hello': 'doc1'}, function (error, cursor) {
                            if (error) {
                                throw new Error(error);
                            }

                            cursor.toArray(function (error, docs) {
                                expect(error).toBeNull();
                                expect(docs).toBeDefined();
                                expect(docs.length).toBeGreaterThan(0);
                                next();
                            });
                        });
                    }).not.toThrow();
                });
            });
        });

        describe('Test all other functions', () => {
            var testDoc = {
                _id: new ObjectID(),
                login: 'paul_brause',
                group: 'test',
                messaging: [{
                    type: 'email',
                    value: 'paul_brause@test.de'
                }]
            };
            var bulkDocA = {
                login: 'peter_lustig',
                group: 'test',
                messaging: [{
                    type: 'email',
                    value: 'peter_lustig@test.de'
                }, {
                    type: 'email',
                    value: 'pl@gmx.de'
                }],
                bulkWrite: true
            };
            var bulkDocB = {
                login: 'max_mustermann',
                group: 'test',
                messaging: [{
                    type: 'email',
                    value: 'max_mustermann@test.de'
                }, {
                    type: 'phone',
                    value: '00490123987654321'
                }, {
                    type: 'email',
                    value: 'max_mustermann@gmail.com'
                }],
                bulkWrite: true
            };
            var insertOne = function (next) {
                Model.insertOne(testDoc, function (error, result) {
                    expect(error).toBeNull();
                    expect(result.result.ok).toBe(1);
                    expect(result.insertedCount).toBe(1);
                    expect(result.insertedId).toBe(testDoc._id);
                    next();
                });
            };
            var deleteOne = function (next) {
                Model.deleteOne({_id: testDoc._id}, function (error, result) {
                    expect(error).toBeNull();
                    expect(result.result.ok).toBe(1);
                    expect(result.deletedCount).toBe(1);
                    next();
                });
            };
            var insertMany = function (next) {
                Model.insertMany([bulkDocA, bulkDocB], function (error, result) {
                    expect(error).toBeNull();
                    expect(result.result.ok).toBe(1);
                    expect(result.insertedCount).toBe(2);
                    next();
                });
            };
            var deleteMany = function (next) {
                Model.deleteMany({bulkWrite: true}, function (error, result) {
                    expect(error).toBeNull();
                    expect(result.result.ok).toBe(1);
                    expect(result.deletedCount).toBe(2);
                    next();
                });
            };
            var ensureAllIndexes = function (next) {
                Model.ensureAllIndexes(function (error) {
                    Model.indexes()
                        .then(function (indexes) {
                            expect(error).toBeNull();
                            // Model indexes don't contain _id index therefore add 1
                            expect(indexes.length).toBe(Model.getIndexes().length + 1);
                            next();
                        });
                });
            };

            beforeEach(function (next) {
                Model.drop((error, result) => {
                    expect(error).toBeNull();
                    expect(result).toBeTruthy();
                    next();
                });
            });

            it('getSingleIndexes', function () {
                expect(_.isArray(Model.getSingleIndexes())).toBeTruthy();
            });
            it('getCompoundIndexes', function () {
                expect(_.isArray(Model.getCompoundIndexes())).toBeTruthy();
            });
            it('getTextIndexes', function () {
                expect(_.isArray(Model.getTextIndexes())).toBeTruthy();
            });
            it('getAllIndexes', function () {
                expect(_.isArray(Model.getIndexes())).toBeTruthy();
            });
            it('ensureIndexes', function (next) {
                const singleIndexes = Model.getSingleIndexes();
                Model.ensureIndexes(singleIndexes, false, function (error) {
                    expect(error).toBeNull();
                    next();
                });
            });
            it('ensureAllIndexes', function (next) {
                ensureAllIndexes(next);
            });
            it('validate', function (next) {
                Model.validate({}, function (error, result) {
                    expect(error.name).toBe('ValidationError');
                    expect(error.err.length).toBe(1);
                    expect(_.isObject(result)).toBeTruthy();
                    next();
                });
            });
            it('db', function () {
                const env = Shared.config('environment');
                const databases = env.mongoDatabases;
                const dbName = Object.keys(databases)[0];
                const db = Model.db(dbName);
                expect(db.databaseName).toBe(dbName);
            });
            it('collection', function (next) {
                const env = Shared.config('environment');
                const databases = env.mongoDatabases;
                const dbName = Object.keys(databases)[0];
                Model.collection(function (error, collection) {
                    expect(error).toBeNull();
                    expect(collection.namespace).toBe([dbName, Model.collectionName].join('.'));
                    next();
                });
            });
            it('insertOne', function (next) {
                insertOne(next);
            });
            it('updateOne', function (next) {
                insertOne(function () {
                    Model.updateOne({_id: testDoc._id}, {$set: {updated: 42}}, function (error, result) {
                        expect(error).toBeNull();
                        expect(result.result.ok).toBe(1);
                        expect(result.matchedCount).toBe(1);
                        expect(result.modifiedCount).toBe(1);

                        Model.findOne({_id: testDoc._id}, {projection: {_id: 0, updated: 1}}, function (error, doc) {
                            expect(error).toBeNull();
                            expect(doc.updated).toBe(42);
                            next();
                        });
                    });
                });
            });
            it('aggregate', function (next) {
                insertMany(function () {
                    Model.aggregate([{$match: {bulkWrite: true}}], function (error, AggregationCursor) {
                        Q.ninvoke(AggregationCursor, 'toArray')
                            .then(function (docs) {
                                expect(error).toBeNull();
                                expect(docs.length).toBe(2);
                                next();
                            });
                    });
                })
            });
            it('bulkWrite', function (next) {
                Model.bulkWrite([
                    {
                        insertOne: bulkDocA
                    },
                    {
                        insertOne: bulkDocB
                    }
                ], function (error, result) {
                    expect(error).toBeNull();
                    expect(result.ok).toBe(1);
                    expect(result.insertedCount).toBe(2);
                    next();
                });
            });
            it('count', function (next) {
                insertMany(function () {
                    Model.count(function (error, count) {
                        expect(error).toBeNull();
                        expect(count).toBe(2);
                        next();
                    });
                });
            });
            it('createIndex', function () {
                // Tested in 'ensureIndexes' and 'ensureAllIndexes'
            });
            it('deleteMany', function (next) {
                insertMany(function () {
                    deleteMany(next);
                });
            });
            it('deleteOne', function (next) {
                insertOne(function () {
                    deleteOne(next);
                });
            });
            it('distinct', function (next) {
                insertMany(function () {
                    Model.distinct('group', function (error, distinctValues) {
                        expect(error).toBeNull();
                        expect(distinctValues.length).toBe(1);
                        expect(distinctValues).toContain('test');
                        next();
                    });
                });
            });
            it('drop', function () {
                // Tested in 'beforeEach'
            });
            it('dropIndex', function (next) {
                Model.indexes()
                    .then(function (indexes) {
                        const index = indexes[indexes.length - 1];
                        Model.dropIndex(index.name, (error, result) => {
                            expect(error).toBeNull();
                            expect(result.ok).toBe(1);
                            expect(result.nIndexesWas).toBe(indexes.length);
                            next();
                        });
                    });
            });
            describe('find', function () {
                it('function', function (next) {
                    insertMany(function () {
                        Model.find({bulkWrite: true}, {projection: {_id: 0, login: 1}}, function (error, cursor) {
                            Q.ninvoke(cursor, 'toArray')
                                .then(function (docs) {
                                    expect(error).toBeNull();
                                    expect(docs.length).toBe(2);
                                    for (let i in docs) {
                                        let doc = docs[i];
                                        expect([bulkDocA.login, bulkDocB.login]).toContain(doc.login);
                                    }
                                    next();
                                });
                        });
                    });
                });
                it('params', function (next) {
                    insertMany(function () {
                        Model.find({bulkWrite: true}, {
                            projection: {_id: 0, login: 1},
                            limit: 1
                        }, function (error, cursor) {
                            Q.ninvoke(cursor, 'toArray')
                                .then(function (docs) {
                                    const doc = docs[0];

                                    expect(error).toBeNull();
                                    // Test limit option
                                    expect(docs.length).toBe(1);
                                    // Test projection
                                    expect(doc._id).toBeUndefined();
                                    expect(doc.login).toBeDefined();
                                    expect(doc.group).toBeUndefined();

                                    next()
                                });
                        });
                    });
                });
            });
            describe('findOne', function () {
                it('function', function () {
                    // Tested in 'updateOne'
                });
                it('params', function (next) {
                    insertOne(function () {
                        Model.findOne({_id: testDoc._id}, {projection: {_id: 0, login: 1}}, function (error, doc) {
                            expect(error).toBeNull();
                            // Test projection
                            expect(doc._id).toBeUndefined();
                            expect(doc.login).toBeDefined();
                            expect(doc.group).toBeUndefined();
                            next();
                        });
                    });
                });
            });
            it('findOneAndDelete', function (next) {
                insertOne(function () {
                    Model.findOneAndDelete({_id: testDoc._id}, function (error, result) {
                        expect(error).toBeNull();
                        expect(result.ok).toBe(1);
                        expect(result.value._id.toString()).toBe(testDoc._id.toString());
                        next();
                    });
                });
            });
            it('findOneAndReplace', function (next) {
                insertOne(function () {
                    Model.findOneAndReplace({_id: testDoc._id}, {replaced: true}, function (error, result) {
                        expect(error).toBeNull();
                        expect(result.ok).toBe(1);
                        expect(result.lastErrorObject.n).toBe(1);
                        expect(result.lastErrorObject.updatedExisting).toBe(true);

                        Model.findOne({_id: testDoc._id}, function (error, doc) {
                            expect(error).toBeNull();
                            expect(doc.login).toBeUndefined();
                            expect(doc.replaced).toBe(true);
                            next();
                        });
                    });
                });
            });
            it('findOneAndUpdate', function (next) {
                insertOne(function () {
                    Model.findOneAndUpdate({_id: testDoc._id}, {
                        $unset: {group: 1},
                        $set: {updated: 42}
                    }, function (error, result) {
                        expect(error).toBeNull();
                        expect(result.ok).toBe(1);
                        expect(result.lastErrorObject.n).toBe(1);
                        expect(result.lastErrorObject.updatedExisting).toBe(true);

                        Model.findOne({_id: testDoc._id}, function (error, doc) {
                            expect(error).toBeNull();
                            expect(doc.group).toBeUndefined();
                            expect(doc.updated).toBe(42);
                            next();
                        });
                    });
                });
            });
            it('geoHaystackSearch', function (next) {
                Model.geoHaystackSearch(42, 177, function (error, result) {
                    expect(error.name).toBe('MongoError');
                    expect(error.message).toBe('no geoSearch index');
                    expect(result).toBeUndefined();
                    next();
                });
            });
            it('indexes', function () {
                // Tested in 'ensureAllIndexes'
            });
            it('indexExists', function (next) {
                Model.indexes()
                    .then(function (indexes) {
                        const index = indexes[indexes.length - 1];
                        Model.indexExists(index.name, (error, indexExists) => {
                            expect(error).toBeNull();
                            expect(indexExists).toBeTruthy();
                            next();
                        });
                    })
            });
            it('indexInformation', function (next) {
                Model.indexInformation(function (error, dbIndexes) {
                    const modelIndexes = Model.getIndexes().map(function (index) {
                        return index.name;
                    });
                    expect(error).toBeNull();
                    for (let indexName in dbIndexes) {
                        if (indexName === '_id_') continue;
                        expect(modelIndexes).toContain(indexName);
                    }
                    next();
                });
            });
            it('initializeOrderedBulkOp', function (next) {
                Model.initializeOrderedBulkOp()
                    .then(function (OrderedBulkOperation) {
                        OrderedBulkOperation.insert(bulkDocA).insert(bulkDocB).execute(function (error, result) {
                            expect(error).toBeNull();
                            expect(result.ok).toBe(1);
                            expect(result.nInserted).toBe(2);
                            next();
                        });
                    })
                    .catch(error => {
                        next.fail(error);
                    });
            });
            it('initializeUnorderedBulkOp', function (next) {
                Model.initializeUnorderedBulkOp()
                    .then(UnorderedBulkOperation => {
                        UnorderedBulkOperation.insert(bulkDocA).insert(bulkDocB).execute(function (error, result) {
                            expect(error).toBeNull();
                            expect(result.ok).toBe(1);
                            expect(result.nInserted).toBe(2);
                            next();
                        });
                    })
                    .catch(error => {
                        next.fail(error);
                    });
            });
            it('insertMany', function (next) {
                insertMany(next);
            });
            it('isCapped', function (next) {
                Model.isCapped()
                    .then(function (isCapped) {
                        expect(isCapped).toBeUndefined();
                        next();
                    });
            });
            it('listIndexes', function (next) {
                ensureAllIndexes(function () {
                    Model.listIndexes()
                        .then(CommandCursor => {
                            return Q.ninvoke(CommandCursor, 'toArray');
                        })
                        .then(indexes => {
                            expect(indexes.length).toBe(Model.getIndexes().length + 1);
                            next();
                        })
                        .catch(error => {
                            next.fail(error);
                        });
                });
            });
            it('mapReduce', function (next) {
                var map = function () {
                    var doc = this;
                    doc.messaging.forEach(function (item) {
                        if (item.type === 'email') {
                            emit(doc.login, item.value);
                        }
                    });
                };
                var reduce = function (login, emailAddresses) {
                    return {
                        email_addresses: emailAddresses
                    };
                };
                var options = {
                    out: {inline: 1},
                    query: {
                        bulkWrite: true
                    }
                };
                insertMany(function () {
                    Model.mapReduce(map, reduce, options, function (error, result) {
                        expect(error).toBeNull();
                        expect(result.length).toBe(2);
                        for (let i in result) {
                            let login = result[i];
                            expect(login.value.email_addresses.length).toBe(2);
                        }
                        next();
                    });
                });
            });
            it('options', function (next) {
                Model.options()
                    .then(function (options) {
                        expect(options).toEqual({});
                        next();
                    });
            });
            it('parallelCollectionScan', function (next) {
                insertMany(function () {
                    Model.parallelCollectionScan(function (error, cursors) {
                        expect(error).toBeNull();
                        expect(cursors.length).toBe(1);
                        next();
                    });
                });
            });
            it('reIndex', function (next) {
                ensureAllIndexes(function () {
                    Model.reIndex(function (error, result) {
                        expect(error).toBeNull();
                        expect(result).toBeTruthy();
                        next();
                    });
                });
            });
            it('rename', function (next) {
                let originalName = Model.collectionName;
                Model.rename(Model.collectionName + 'Renamed', function (error, result) {
                    expect(error).toBeNull();
                    expect(_.isObject(result)).toBeTruthy();
                    Model.collectionName = Model.collectionName + 'Renamed';

                    Model.rename(originalName, function (error, result) {
                        expect(error).toBeNull();
                        expect(_.isObject(result)).toBeTruthy();
                        Model.collectionName = originalName;
                        next();
                    });
                });
            });
            it('stats', function (next) {
                Model.stats()
                    .then(function (stats) {
                        expect(_.isObject(stats)).toBeTruthy();
                        next();
                    });
            });
            it('updateMany', function (next) {
                insertMany(function () {
                    Model.updateMany({bulkWrite: true}, {
                        $unset: {group: 1},
                        $set: {updated: 42}
                    }, function (error, {result}) {
                        expect(error).toBeNull();
                        expect(result.ok).toBe(1);
                        expect(result.n).toBe(2);
                        expect(result.nModified).toBe(2);

                        Model.find({bulkWrite: true}, function (error, cursor) {
                            Q.ninvoke(cursor, 'toArray')
                                .then(function (docs) {
                                    for (let i in docs) {
                                        let doc = docs[i];
                                        expect(doc.group).toBeUndefined();
                                        expect(doc.updated).toBe(42);
                                    }
                                    next();
                                });
                        });
                    });
                });
            });
        });
    });
});
