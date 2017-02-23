var ErrorHandler = require('./../../errorHandler');

describe("External modules", function () {

    it("must be available", function (next) {
        expect(ErrorHandler).toBeDefined();
        next();
    });
});
