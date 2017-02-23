var BaseClass = require('./../../baseClass');

describe("Inheritance module", function () {
    var valueA = "Hello!";
    var valueB = "Great!";
    var valueC = "Bye!";
    var ChildClass1, ChildClass2, instance1, instance2;

    describe("Class's 'extend' function", function () {
        it("must be defined", function (next) {
            expect(BaseClass.extend).toBeDefined();
            next();
        });

        it("must run on base class", function (next) {
            expect(ChildClass1 = BaseClass.extend({
                memberA: valueA,
                memberB: valueB,
                functionA: function () {
                    return this;
                }
            })).not.toThrow();
            next();
        });

        it("must run on derived class", function (next) {
            expect(ChildClass2 = ChildClass1.extend({
                memberC: valueC
            })).not.toThrow();
            next();
        });

        describe("Child class", function () {
            it("must be instantiatable", function (next) {
                expect(function () {
                    instance1 = new ChildClass1();
                }).not.toThrow();
                next();
            });

            describe("Its instances", function () {
                it("must contain memberA with correct value", function (next) {
                    expect(instance1.memberA).toEqual(valueA);
                    next();
                });

                it("must contain memberB with correct value", function (next) {
                    expect(instance1.memberB).toEqual(valueB);
                    next();
                });

                it("must be valid instances of ChildClass1", function (next) {
                    expect(instance1 instanceof ChildClass1).toEqual(true);
                    next();
                });

                it("must be no valid instances of ChildClass2", function (next) {
                    expect(instance1 instanceof ChildClass2).toEqual(false);
                    next();
                });
            });
        });

        describe("Child's child class", function () {
            it("must be instantiatable", function (next) {
                expect(function () {
                    instance2 = new ChildClass2();
                }).not.toThrow();
                next();
            });

            describe("Its instances", function () {
                it("must contain memberA with correct value", function (next) {
                    expect(instance2.memberA).toEqual(valueA);
                    next();
                });

                it("must contain memberB with correct value", function (next) {
                    expect(instance2.memberB).toEqual(valueB);
                    next();
                });

                it("must contain memberC with correct value", function (next) {
                    expect(instance2.memberC).toEqual(valueC);
                    next();
                });

                it("must be valid instances of ChildClass1", function (next) {
                    expect(instance2 instanceof ChildClass1).toEqual(true);
                    next();
                });

                it("must be valid instances of ChildClass2", function (next) {
                    expect(instance2 instanceof ChildClass2).toEqual(true);
                    next();
                });
            });
        });

        describe("Calling child's method from parent class", function () {
            it("'this' must have correct value", function (next) {
                expect(instance2.functionA()).toEqual(instance2);
                next();
            });
        });
    });
});
