var ErrorHandler = require('mia-js-core/lib/errorHandler');

describe("External modules", function () {

    it("must be available", function (next) {
        expect(ErrorHandler).toBeDefined();
        next();
    });
});
