var validModel = "./data/validModel.js";
var ExampleModel = require(validModel);
var Validator = require('./../../modelValidator');

//Valid data set
var exampleData1 = {
    session: {
        set: true,
        ip: '127.0.0.1',
        cidr: '127.0.0.1/30'
    },
    culture: {
        code: 'fr-be'
    },
    app: {
        id: 'Mr. Crown',
        version: '1.0',
        vendor: {
            'id': 'MyVendor'
        },
        advertiser: {
            'id': 'MyAdvertiser'
        }
    },
    device: {
        userAgent: 'Mozilla/5.0 (iPhone; U; CPU iPhone OS 4_3_3 like Mac OS X; en-us) AppleWebKit/533.17.9 (KHTML, like Gecko) Version/5.0.2 Mobile/8J2 Safari/6533.18.5',
        carrier: {
            type: 'MyCarrier'
        },
        screen: {
            resolution: '320x460'
        }
    },
    status: 'active',
    messages: [
        {
            name: 'testuser1',
            send: false
        },
        {
            name: 'testuser2',
            send: false
        }
    ],
    customData: [
        {
            just: {
                some: 'data'
            }
        }
    ],
    nameOfChildren: ['Ben', 'Lara', 'Emma'],
    mustbethere: true
};

//Invalid data set
var exampleData2 = {
    session: {
        set: 'aaa',
        ip: '927.0.0.1',
        cidr: '127.0.0.1'
    },
    culture: {
        region: 'fr'
    },
    app: {
        id: '13auto',
        version: 'aa',
        vendor: {
            'id': 'MyVendorMyVendorMyVendorMyVendorMyVendorMyVendorMyVendorMyVendorMyVendorMyVendorMyVendorMyVendorMyVendorMyVendorMyVendor'
        },
        advertiser: {
            'id': 'M'
        }
    },
    device: {
        userAgent: '',
        carrier: {
            type: 'MyCarrierMyCarrierMyCarrierMyCarrierMyCarrierMyCarrierMyCarrierMyCarrierMyCarrierMyCarrierMyCarrierMyCarrierMyCarrier'
        },
        screen: {
            resolution: 'aaxbb'
        }
    },
    status: 12,
    messages: [
        {
            name: 12,
            send: false
        },
        {
            name: true,
            send: false
        }
    ],
    customData: 12,
    nameOfChildren: [
        {name: 'Ben'},
        {name: 'Lara'},
        {name: 'Emma'}
    ],
    maxvalues: 21,
    minvalues: 1
};

//Invalid data set
var exampleData3 = {
    culture: {
        code: 'de-de'
    },
    session: {
        id: '1234567890123456789012345678901234567890123456789012345678901234'
    }
};

// Test validator functions
describe("Validator", function () {

    it("must be defined", function (next) {
        expect(Validator).toBeDefined();
        next();
    });

    it("example valid-model must be available at '" + validModel + "'", function (next) {
        expect(ExampleModel).toBeDefined();
        next();
    });

    describe("Function findNodes", function () {

        it("must be defined", function (next) {
            expect(Validator.findNodes).toBeDefined();
            next();
        });

        it("must return valid results for unique", function (next) {
            var model = new ExampleModel();
            var uniques = Validator.findNodes(model, 'unique');
            expect(uniques[0]).toEqual('id');
            expect(uniques[1]).toEqual('session.id');
            next();
        });

        it("must return valid results for index:true", function (next) {
            var model = new ExampleModel();
            var indexes = Validator.findNodes(model, 'index', true);
            expect(indexes[0]).toEqual('id');
            expect(indexes[1]).toEqual('session.id');
            expect(indexes[2]).toEqual('session.cidr');
            expect(indexes[3]).toEqual('session.ip');
            expect(indexes[4]).toEqual('session.expireable');
            expect(indexes[5]).toEqual('session.created');
            expect(indexes[6]).toEqual('messages.name');
            next();
        });
    });

    describe("Function validate", function () {

        it("mustbe defined", function (next) {
            expect(Validator.validate).toBeDefined();
            next();
        });

        it("must return valid results with valid data", function (next) {
            var error;
            var data;
            var done = false;
            var model = new ExampleModel();

            //start validation process
            runs(function () {
                expect(function () {
                    Validator.validate(exampleData1, model, {}, function (err, data1) {
                        error = err;
                        data = data1;
                        done = true;
                    });
                }).not.toThrow();
            });

            //wait for validation is finished
            waitsFor(function () {
                return done;
            }, "Validator.validate", 3000);

            //evaluate validation results
            runs(function () {
                expect(error == null).toBeTruthy();
                expect(data.app.advertiser.id).toEqual('myadvertiser');
                expect(data.app.id).toEqual('Mr.Crown');
                expect(data.app.vendor.id).toEqual('myvendor');
                expect(data.app.version).toEqual('1.0');
                expect(data.created).toBeDefined();
                expect(data.culture.region).toEqual('be');
                expect(data.culture.language).toEqual('fr');
                expect(data.culture.code).toBeUndefined();
                expect(data.device.carrier.type).toEqual('mycarrier');
                expect(data.device.os.type).toEqual('ios');
                expect(data.device.os.version).toEqual('4.3.3');
                expect(data.device.screen.height).toEqual(320);
                expect(data.device.screen.width).toEqual(460);
                expect(data.device.screen.resolution).toBeUndefined();
                expect(data.device.type).toEqual('phone');
                expect(data.device.userAgent).toBeDefined();
                expect(data.id).toBeDefined();
                expect(data.status).toEqual('active');
                expect(data.lastModified).toBeDefined();
                expect(data.session.created).toBeDefined();
                expect(data.session.cidr).toEqual('127.0.0.1/30');
                expect(data.session.ip).toEqual('127.0.0.1');
                expect(data.session.expireable).toBeDefined();
                expect(data.session.id).toBeDefined();
                expect(data.messages[0].message).toEqual('This is a test message');
                expect(data.messages[0].name).toEqual('TESTUSER1');
                expect(data.messages[0].send).toBeUndefined();
                expect(data.messages[1].message).toEqual('This is a test message');
                expect(data.messages[1].name).toEqual('TESTUSER2');
                expect(data.messages[1].send).toBeUndefined();
                expect(data.customData[0].just.some).toEqual('data');
                expect(data.nameOfChildren[0]).toEqual('BEN');
                expect(data.nameOfChildren[1]).toEqual('LARA');
                expect(data.nameOfChildren[2]).toEqual('EMMA');
            });
            next();
        });


        // TEST INVALID DATA
        it("must return errors with invalid data", function (next) {
            var error;
            var data;
            var done = false;
            var model = new ExampleModel();

            //start validation process
            runs(function () {
                expect(function () {
                    Validator.validate(exampleData2, model, {'partial': false}, function (err, data1) {
                        error = err.err;
                        data = data1;
                        done = true;
                    });
                }).not.toThrow();
            });

            //wait for validation is finished
            waitsFor(function () {
                return done;
            }, "Validator.validate", 3000);

            //evaluate validation results
            runs(function () {
                expect(error == null).toBeFalsy();
                expect(error[0].code).toEqual('UnexpectedType');
                expect(error[0].id).toEqual('session.set');
                expect(error[1].code).toEqual('UnexpectedType');
                expect(error[1].id).toEqual('session.cidr');
                expect(error[2].code).toEqual('UnexpectedType');
                expect(error[2].id).toEqual('session.ip');
                expect(error[3].code).toEqual('ValueNotAllowed');
                expect(error[3].id).toEqual('app.id');
                expect(error[4].code).toEqual('PatternMismatch');
                expect(error[4].id).toEqual('app.version');
                expect(error[5].code).toEqual('MaxLengthExceeded');
                expect(error[5].id).toEqual('app.vendor.id');
                expect(error[6].code).toEqual('MinLengthUnderachieved');
                expect(error[6].id).toEqual('app.advertiser.id');
                expect(error[7].code).toEqual('MaxLengthExceeded');
                expect(error[7].id).toEqual('device.carrier.type');
                expect(error[8].code).toEqual('UnexpectedType');
                expect(error[8].id).toEqual('device.screen.height');
                expect(error[9].code).toEqual('UnexpectedType');
                expect(error[9].id).toEqual('device.screen.width');
                expect(error[10].code).toEqual('PatternMismatch');
                expect(error[10].id).toEqual('device.screen.resolution');
                expect(error[11].code).toEqual('ValueNotAllowed');
                expect(error[11].id).toEqual('status');
                expect(error[12].code).toEqual('UnexpectedType');
                expect(error[12].id).toEqual('nameOfChildren');
                expect(error[13].code).toEqual('MissingRequiredParameter');
                expect(error[13].id).toEqual('mustbethere');
                expect(error[14].code).toEqual('MaxValueExceeded');
                expect(error[14].id).toEqual('maxvalues');
                expect(error[15].code).toEqual('MinValueUnderachived');
                expect(error[15].id).toEqual('minvalues');
            });
            next();
        });

        // TEST VALID DATA WITH OPTION query
        it("must return errors with valid data and option query", function (next) {
            var error;
            var data;
            var done = false;
            var model = new ExampleModel();

            //start validation process
            runs(function () {
                expect(function () {
                    Validator.validate(exampleData3, model, {query: true, partial: true}, function (err, data1) {
                        error = err;
                        data = data1;
                        done = true;
                    });
                }).not.toThrow();
            });

            //wait for validation is finished
            waitsFor(function () {
                return done;
            }, "Validator.validate", 3000);

            //evaluate validation results
            runs(function () {
                expect(error == null).toBeTruthy();
                expect(data.culture.language).toEqual('de');
                expect(data.culture.region).toEqual('de');
                expect(data.culture.code).toBeUndefined();
                expect(data.culture.region).toEqual('de');
                expect(data.session.id).toBeDefined();
            });
            next();
        });

    });

});
