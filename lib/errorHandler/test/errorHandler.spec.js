var ErrorHandler = require('./../../errorHandler');
var MiaError = require('../lib/error');

describe('errorHandler', function () {
    describe("External modules", function () {
        it("must be available", function (next) {
            expect(ErrorHandler).toBeDefined();
            next();
        });
    });
    describe("Cast different errors to MiaError", function () {
        it("simple String", function (next) {
            const message = "This is a simple error message";
            const error = new MiaError(message);
            expect(error).toBeTruthy(error instanceof Error);
            expect(error.stack).toBeDefined();
            expect(error.message).toBe(message);
            expect(error.name).toBe('MiaError');
            expect(error.status).toBeUndefined();
            expect(error.raw).toBeUndefined();
            expect(error.err).toEqual({
                code: undefined,
                id: undefined,
                msg: message
            });
            next();
        });
        it("built-in error object", function (next) {
            const message = "This is a built-in error object";
            const error = new MiaError(new Error(message));
            expect(error).toBeTruthy(error instanceof Error);
            expect(error.stack).toBeDefined();
            expect(error.message).toBe(message);
            expect(error.name).toBe('Error');
            expect(error.status).toBeUndefined();
            expect(error.raw).toBeUndefined();
            expect(error.err).toEqual({
                code: undefined,
                id: undefined,
                msg: message
            });
            next();
        });
        it("custom error object with name", function (next) {
            const name = "InternalError";
            const message = "This is a custom error object with name";
            const error = new MiaError({
                name: name,
                err: message
            });
            expect(error).toBeTruthy(error instanceof Error);
            expect(error.stack).toBeDefined();
            expect(error.message).toBe(message);
            expect(error.name).toBe(name);
            expect(error.status).toBeUndefined();
            expect(error.raw).toBeUndefined();
            expect(error.err).toEqual({
                code: undefined,
                id: undefined,
                msg: message
            });
            next();
        });
        it("custom error object with status and code (controllers)", function (next) {
            const status = 500;
            const code = "InternalServerError";
            const message = "This is a custom error object with status and code";
            const error = new MiaError({
                status: status,
                err: {code: code, msg: message}
            });
            expect(error).toBeTruthy(error instanceof Error);
            expect(error.stack).toBeDefined();
            expect(error.message).toBe(message);
            expect(error.name).toBe('MiaError');
            expect(error.status).toBe(status);
            expect(error.raw).toBeUndefined();
            expect(error.err).toEqual({
                code: code,
                id: undefined,
                msg: message
            });
            next();
        });
        it("custom error object with code, id and message (modelValidator)", function (next) {
            const code = "MissingRequiredParameter";
            const id = "key";
            const message = id + " is required but invalid value or no value given";
            const error = new MiaError({
                code: code,
                id: id,
                msg: message
            });
            expect(error).toBeTruthy(error instanceof Error);
            expect(error.stack).toBeDefined();
            expect(error.message).toBe(message);
            expect(error.name).toBe('MiaError');
            expect(error.status).toBeUndefined();
            expect(error.raw).toBeUndefined();
            expect(error.err).toEqual({
                code: code,
                id: id,
                msg: message
            });
            next();
        });
        it("custom error object with status, name and raw as String (initializeRoutes)", function (next) {
            const status = 500;
            const name = "ApplicationException";
            const raw = "Something went wrong!";
            const error = new MiaError({status: status, name: name, raw: raw});
            expect(error).toBeTruthy(error instanceof Error);
            expect(error.stack).toBeDefined();
            expect(error.message).toBe('');
            expect(error.name).toBe(name);
            expect(error.status).toBe(status);
            expect(error.raw).toBe(raw);
            expect(error.err).toEqual({
                code: undefined,
                id: undefined,
                msg: undefined
            });
            next();
        });
        it("custom error object with status, name and raw as Error (initializeRoutes)", function (next) {
            const status = 500;
            const name = "ApplicationException";
            const raw = new Error("Something went wrong!");
            const error = new MiaError({status: status, name: name, raw: raw});
            expect(error).toBeTruthy(error instanceof Error);
            expect(error.stack).toBeDefined();
            expect(error.message).toBe('');
            expect(error.name).toBe(name);
            expect(error.status).toBe(status);
            expect(error.raw).toBe(raw);
            expect(error.err).toEqual({
                code: undefined,
                id: undefined,
                msg: undefined
            });
            next();
        });
        it("MiaError", function (next) {
            const status = 500;
            const code = "InternalServerError";
            const message = "This is a custom error object with status and code";
            const child = new MiaError({
                status: status,
                err: {code: code, msg: message}
            });
            const error = new MiaError(child);
            expect(error).toBeTruthy(error instanceof Error);
            expect(error.stack).toBeDefined();
            expect(error.message).toBe(message);
            expect(error.name).toBe('MiaError');
            expect(error.status).toBe(status);
            expect(error.raw).toBeUndefined();
            expect(error.err).toEqual({
                code: code,
                id: undefined,
                msg: message
            });
            next();
        });
        it("array of errors", function (next) {
            const name = "ValidationError";
            const arrayOfErrors = [
                {
                    code: "MissingRequiredParameter",
                    id: "key",
                    msg: "key is required but invalid value or no value given"
                },
                {
                    code: "ValueNotAllowed",
                    id: "id",
                    msg: "bla bla bla"
                }
            ];
            const error = new MiaError({
                name: name, err: arrayOfErrors
            });
            expect(error).toBeTruthy(error instanceof Error);
            expect(error.stack).toBeDefined();
            expect(error.message).toBe('');
            expect(error.name).toBe('ValidationError');
            expect(error.status).toBeUndefined();
            expect(error.raw).toBeUndefined();
            expect(error.err).toEqual(arrayOfErrors);
            next();
        });
    });
});
