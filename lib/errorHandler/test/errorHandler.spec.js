var ErrorHandler = require('./../../errorHandler');

describe('errorHandler', function () {
    describe("External modules", function () {
        it("must be available", function (next) {
            expect(ErrorHandler).toBeDefined();
            next();
        });
    });
});
