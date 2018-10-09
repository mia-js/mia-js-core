class MiaError extends Error {
    constructor(object) {
        super(object.err && object.err.msg ? object.err.msg : undefined);
        Error.captureStackTrace(this, MiaError);
        this.status = object.status || undefined;
        this.err = {
            "code": object.err && object.err.code ? object.err.code : undefined,
            "msg": object.err && object.err.msg ? object.err.msg : undefined
        }
    }
}

module.exports = MiaError;
