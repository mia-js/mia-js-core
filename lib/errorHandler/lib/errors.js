/**
 * Default error handler
 */

var _ = require('lodash');
var Shared = require('./../../shared');
var Utils = require('./../../utils');
var Logger = require('./../../logger');

// Error syntax:
//
//next({
//    status: 400
//});
//
//next({
//    status: 400,
//    err: {
//        'code': 'SessionTokenEmpty',
//        'msg': translator('system', 'SessionTokenEmpty')
//    }
//});
//
//next({
//    status: 400,
//    err: [{
//        'code': 'SessionTokenEmpty',
//        'msg': translator('system', 'SessionTokenEmpty')
//    }]
//});
//
//next({
//    status: 400,
//    err: {
//        name: 'ValidationError',
//        err: [
//            {
//                "code": "string",
//                "msg": "string"
//            }
//        ]
//    }
//});

function thisModule() {
    var self = this;
    var parseError = function (err) {
        // Auto-check error type
        var env = Shared.config("environment");
        if (err.name) {
            switch (err.name) {
                case 'InternalError':
                {
                    err = err.err;
                    break;
                }
                case 'MongoError':
                {
                    if (err.code && (err.code == 11000 || err.code == 11001)) {
                        err = [
                            {code: 'DataRecordAlreadyExist', msg: 'Data record already exist in database'}
                        ];
                    }
                    break;
                }
                case 'ValidationError':
                {
                    err = err.err;
                    break;
                }
                case 'ApplicationException':
                {
                    var debugMode = env.debug;
                    if (debugMode) {
                        err = err.err;
                    }
                    else {
                        err = "Stack trace is shown only in debug mode";
                    }
                }
                case 'ExternalError':
                {
                    var debugMode = env.debug;
                    if (debugMode) {
                        err = err.err;
                    }
                    else {
                        err = "Stack trace is shown only in debug mode";
                    }
                }
            }
        }
        return err;
    };

    self.handleError = function (err, req, res) {

        var Translator = req.miajs.translator;

        var response = {}
            , status = err.status || 500
            , errors
            , defaultErrors = {
                '400': [
                    {code: 'BadRequest', msg: Translator('system', 'BadRequest')}
                ],
                '401': [
                    {code: 'Unauthorized', msg: Translator('system', 'Unauthorized')}
                ],
                '403': [
                    {code: 'Forbidden', msg: Translator('system', 'Forbidden')}
                ],
                '404': [
                    {code: 'NotFound', msg: Translator('system', 'NotFound')}
                ],
                '410': [
                    {code: 'Gone', msg: Translator('system', 'Gone')}
                ],
                '500': [
                    {code: 'InternalServerError', msg: Translator('system', 'InternalServerError')}
                ]
            },
            errorsWithoutBody = [204, 304, 412];


        // Check if errors message given or fallback to default error messages
        if (_.isEmpty(err.err)) {
            if (defaultErrors[status]) {
                errors = defaultErrors[status];
            }
            else {
                errors = defaultErrors['500'];
            }
        }
        else {
            // Parse error
            errors = parseError(err.err);
        }

        if (errorsWithoutBody.indexOf(status) < 0) {
            if (_.isEmpty(errors)) {
                errors = defaultErrors['500'];
            }

            if (!_.isArray(errors)) {
                errors = [errors];
            }

            response = {
                status: status,
                errors: errors,
                debug: Utils.DebugCollector(req, err)
            };
        }

        //Remove debug infos if not in debug mode
        if (response && req && req.header && req.header('debug') != 'true') {
            delete(response.debug);
        }

        return {response: response, status: status};
        //res.send(response, status);
    };

    self.output = function (err, req, res) {
        var output = self.handleError(err, req, res);
        res.send(output.response, output.status);
    }

    return self;
};

module.exports = thisModule();