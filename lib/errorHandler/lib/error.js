const _ = require('lodash');

class MiaError extends Error {
    constructor(error) {
        let message;
        if (_.isString(error)) {
            message = error;
        } else if (_.get(error, 'err.msg')) {
            message = _.get(error, 'err.msg');
        } else if (_.get(error, 'message')) {
            message = _.get(error, 'message');
        } else if (_.isString(_.get(error, 'err'))) {
            message = _.get(error, 'err');
        } else if (_.isString(_.get(error, 'msg'))) {
            message = _.get(error, 'msg');
        }
        super(message); // Sets this.message
        if (_.isString(_.get(error, 'stack'))) {
            this.stack = error.stack;
        } else {
            // Only if there is no stack trace already, capture a new one
            Error.captureStackTrace(this, MiaError);
        }
        this.name = _.get(error, 'name', 'MiaError');
        this.status = _.get(error, 'status');
        this.raw = _.get(error, 'raw'); // Can be String or Object/Error
        if (_.isArray(_.get(error, 'err'))) {
            this.err = _.get(error, 'err');
            this.message = JSON.stringify(this.err);
        } else {
            this.err = {
                code: _.get(error, 'err.code') || _.get(error, 'code'),
                id: _.get(error, 'id'),
                msg: message
            }
        }
    }
}

module.exports = MiaError;
