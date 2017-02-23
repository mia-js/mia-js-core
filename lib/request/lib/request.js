var Shared = require('./../../shared')
    , Logger = require('./../../logger')
    , Q = require('q')
    , Utils = require('./../../utils')
    , Qext = Utils.Qext
    , Http = require('follow-redirects').http
    , Https = require('follow-redirects').https;

Q.stopUnhandledRejectionTracking();

function thisModule() {
    var self = this;

    var _queryToString = function (query) {
        var result = '';
        if (query) {
            for (var item in query) {
                if (query.hasOwnProperty(item)) {
                    if (result != '') {
                        result += '&';
                    }
                    //result += item + "=" + query[item];
                    result += encodeURI(item) + "=" + encodeURI(query[item]);

                }
            }
        }

        if (result != '') {
            result = '?' + result;
        }

        return result;
    };

    /**
     * Sends a http/http request
     * @param requestOptions :: {
     *      options : {
     *          see node docs, http://nodejs.org/api/http.html#http_class_http_clientrequest
     *      },
     *      protocol: {'http', 'https'} (default 'https')
     *      timeout: in ms
     *      outputStats: if 'true', output stats. Beware, that in this case the promise is resolved with an array: [data, stats] instead of single value.
     *  }
     * @param callback :: (err, data, {timeElapsed: ms})
     * @returns {Promise}
     */
    self.do = function (requestOptions, callback) {
        requestOptions = requestOptions || {};
        return Qext.callNodeFunc({
            obj: self,
            func: _do,
            callback: callback,
            options: {returnAsArray: requestOptions.outputStats === true}
        }, requestOptions);
    };

    var _do = function (requestOptions, callback) {
        requestOptions = requestOptions || {};

        var timeOnStart;
        var protocol = requestOptions.protocol === 'http' ? Http : Https;
        if (!requestOptions.options) {
            callback({name: 'ApplicationException', err: "'requestOptions.options' is missing"});
            return;
        }
        if (!requestOptions.options.hostname) {
            callback({name: 'ApplicationException', err: "'requestOptions.options.hostname' is missing"});
            return;
        }
        if (!requestOptions.options.path) {
            callback({name: 'ApplicationException', err: "'requestOptions.options.path' is missing"});
            return;
        }

        requestOptions.options.agent = Shared.keepAliveAgent(requestOptions.protocol);

        var query = _queryToString(requestOptions.query);

        //add query to path
        requestOptions.options.path = requestOptions.options.path + query;

        var postData;
        if (requestOptions.body) {
            postData = requestOptions.body;
            if (requestOptions.json === true) {
                postData = JSON.stringify(postData);
                requestOptions.options.headers = requestOptions.options.headers || {};
                requestOptions.options.headers['Content-Type'] = 'application/json';
            }
        }

        var req = protocol.request(requestOptions.options, function (res) {
            var output = '';

            res.on('data', function (chunk) {
                output += chunk;
            });

            res.on('end', function () {
                var timeElapsed = Date.now() - timeOnStart;

                //console.log(requestOptions.options.agent.getCurrentStatus());

                if (requestOptions.outputType == null || requestOptions.outputType === 'json') {
                    try {
                        output = JSON.parse(output);
                    }
                    catch (err) {
                        Logger.error("Response is not a valid JSON document. Request: " + JSON.stringify(requestOptions));
                        callback({
                            'status': 500,
                            name: 'ExternalError',
                            err: {
                                code: 'ExternalDataRequestError',
                                msg: 'External API did not return valid JSON document'
                            }
                        });
                        return;
                    }
                }

                if (res.statusCode == 200) {
                    callback(null, output, {'timeElapsed': timeElapsed});
                }
                else {
                    //Logger.error(err);
                    callback({
                        'status': 500,
                        name: 'ExternalError',
                        err: {
                            code: 'ExternalDataRequestError',
                            msg: 'External API returned status code ' + res.statusCode,
                            statusCode: res.statusCode
                        }
                    });
                }
            });
        });

        req.setTimeout(requestOptions.timeout);

        req.on('error', function (err) {
            //Logger.error(err);
            callback({
                'status': 500,
                name: 'ExternalError',
                err: {code: 'ExternalDataRequestError', msg: 'Error calling external API'}
            });
        });

        req.on('timeout', function (err) {
            Logger.warn('External request to ' + requestOptions.options.hostname + ' timed out', err);
            callback({
                'status': 500,
                name: 'ExternalError',
                err: {code: 'ExternalDataRequestTimeoutError', msg: 'Timeout error calling external API'}
            });
        });

        timeOnStart = Date.now();

        if (postData) {
            req.write(postData);
        }

        req.end(requestOptions.data);
    };

    self.http = function (options, callback) {
        options = options || {};
        options.protocol = 'http';
        self.do(options, callback);
    };

    self.https = function (options, callback) {
        options = options || {};
        options.protocol = 'https';
        self.do(options, callback);
    };

    return self;
};

module.exports = new thisModule();