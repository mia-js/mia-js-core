global.sharedInfo = null;
var Shared = require('./../../shared')
    , MongoAdapter = require('./../../dbAdapters').MongoAdapter;

// Currently skipped, because it is not a unit test, but an integration test and needs to be reworked for the newer driver.
xdescribe("Initialize", function () {
    it("do inits", function (next) {
        //initialize config
        Shared.initializeConfig('/config', process.argv[2]);
        //create new mongo db Adapter
        var mongoDbAdapter = new MongoAdapter();
        //register adapter
        Shared.registerDbAdapter('mongo', mongoDbAdapter);
        next();
    });

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

            describe("Getting collection", function () {
                var collection;
                var collection1;
                var collection2;

                beforeEach(function (next) {
                    var error;
                    var done = false;

                    runs(function () {
                        expect(function () {
                            Model.collection(function (err, coll) {
                                collection = coll;
                                error = err;
                                done = true;
                            });
                        }).not.toThrow();
                    });

                    waitsFor(function () {
                        return done;
                    }, "Model.collection", 3000);

                    //evaluate results
                    runs(function () {
                        expect(collection == null).toBeFalsy();
                        expect(error == null).toBeTruthy();
                    });

                    next();
                });

                it("must return collection on first call", function (next) {
                    collection1 = collection;
                    next();
                });

                it("must return the same collection on second call", function (next) {
                    collection2 = collection;
                    expect(collection1).toEqual(collection2);
                    next();
                });
            });

            describe("Dropping collection", function () {
                it("must work", function (next) {
                    var data, error, done = false;
                    runs(function () {
                        expect(function () {
                            Model.drop(function (err, dta) {
                                data = dta;
                                error = err;
                                done = true;
                            });
                        }).not.toThrow();
                    });

                    waitsFor(function () {
                        return done;
                    }, "Model.drop", 3000);

                    //evaluate results
                    runs(function () {
                        expect(error == null).toBeTruthy();
                    });

                    next();
                });
            });

            describe("Creating/ensuring indexes", function () {
                it("must work", function (next) {
                    var data, error, done = false;
                    runs(function () {
                        expect(function () {
                            Model.ensureAllIndexes(function (err, dta) {
                                data = dta;
                                error = err;
                                done = true;
                            });
                        }).not.toThrow();
                    });

                    waitsFor(function () {
                        return done;
                    }, "Model.ensureAllIndexes", 3000);

                    //evaluate results
                    runs(function () {
                        expect(error == null).toBeTruthy();
                    });

                    next();
                });
            });

            describe("Inserting objects", function () {
                var error;
                var data;
                var done = false;

                beforeEach(function (next) {
                    done = false;
                    next();
                });

                afterEach(function (next) {
                    waitsFor(function () {
                        return done;
                    }, "modelInstance.schema...", 3000);

                    //evaluate results
                    runs(function () {
                        expect(error == null).toBeTruthy();
                    });

                    next();
                });

                it("inserting arbitrary document", function (next) {
                    runs(function () {
                        expect(function () {
                            modelInstance.schema.insert({'hello': 'doc1'}, {validate: false}, function (err, dta) {
                                data = dta;
                                error = err;
                                done = true;
                            });
                        }).not.toThrow();
                    });
                    next();
                });

                it("inserting and validating document with schema's 'insert' function", function (next) {
                    runs(function () {
                        expect(function () {
                            var values = {};
                            values.userId = '4';
                            values['culture'] = {};
                            values['culture.code'] = 'de-de';
                            values['culture']['language'] = 'de';
                            values['culture']['region'] = 'ca';
                            values['appversion'] = 19;

                            Model.insert(values, function (err, dta) {
                                data = dta;
                                error = err;
                                done = true;
                            });
                        }).not.toThrow();
                    });
                    next();
                });

                it("inserting document with id === null (unique, sparse)", function (next) {
                    runs(function () {
                        expect(function () {
                            var values = {};
                            //values.userId = null;
                            values['culture'] = {};
                            values['culture.code'] = 'de-at';
                            values['culture']['language'] = 'de';
                            values['culture']['region'] = 'ca';
                            values['appversion'] = 19;

                            Model.insert(values, function (err, dta) {
                                data = dta;
                                error = err;
                                done = true;
                            });
                        }).not.toThrow();
                    });
                    next();
                });

                it("inserting document with id === null (unique, sparse)", function (next) {
                    runs(function () {
                        expect(function () {
                            var values = {};
                            //values.userId = null;
                            values['culture'] = {};
                            values['culture.code'] = 'de-de';
                            values['culture']['language'] = 'de';
                            values['culture']['region'] = 'ca';
                            values['appversion'] = 3;

                            Model.insert(values, function (err, dta) {
                                data = dta;
                                error = err;
                                done = true;
                            });
                        }).not.toThrow();
                    });
                    next();
                });

                it("updating and validating document with schema's 'update' function", function (next) {
                    runs(function () {
                        expect(function () {
                            var values = {};
                            values.userId = '5';
                            values['culture'] = {};
                            values['culture.code'] = 'de-de';
                            values['culture']['language'] = 'ef';
                            values['culture']['region'] = 'ca';
                            values['appversion'] = 19;

                            Model.update({userId: values.userId}, values, function (err, dta) {
                                data = dta;
                                error = err;
                                done = true;
                            });
                        }).not.toThrow();
                    });
                    next();
                });

                it("findOne", function (next) {
                    runs(function () {
                        expect(function () {
                            Model.findOne({'hello': 'doc1' }, function (err, dta) {
                                data = dta;
                                error = err;
                                done = true;
                            });
                        }).not.toThrow();
                    });
                    next();
                });

                it("count all", function (next) {
                    runs(function () {
                        expect(function () {
                            Model.count(function (err, dta) {
                                data = dta;
                                error = err;
                                done = true;
                            });
                        }).not.toThrow();
                    });
                    next();
                });

                it("count with query", function (next) {
                    runs(function () {
                        expect(function () {
                            Model.count({'hello': 'doc1' }, function (err, dta) {
                                data = dta;
                                error = err;
                                done = true;
                            });
                        }).not.toThrow();
                    });
                    next();
                });
            });

            describe("Quering db: 'find'", function () {
                it("must work", function (next) {
                    var data, error, done = false;
                    runs(function () {
                        expect(function () {
                            Model.find({'hello': 'doc1' }, function (err, dta) {
                                if (err) {
                                    throw new Error(err);
                                }

                                dta.toArray(function (err, items) {
                                    data = items;
                                    error = err;
                                    done = true;
                                });
                            });
                        }).not.toThrow();
                    });

                    waitsFor(function () {
                        return done;
                    }, "Model.find", 3000);

                    //evaluate results
                    runs(function () {
                        expect(data == null).toBeFalsy();
                        expect(data.length).toBeGreaterThan(0);
                        expect(error == null).toBeTruthy();
                    });

                    next();
                });
            });
        });
    });
});