var _ = require('lodash')
    , Q = require('q')
    , MiaError = require('../../errorHandler/lib/error');

Q.stopUnhandledRejectionTracking();

function thisModule() {
    var self = this;

    /**
     * Chains a list of promise-returning functions sequentially
     * @param steps :: Array of promise-returning functions. On empty argument succeeds
     * @param params :: Forwards params to the first promise-returning function as argument.
     * @returns Promise
     */
    self.sequence = function (steps, params) {
        if (_.isFunction(steps)) {
            steps = [steps];
        }

        var lastPromise = Q(params);
        if (_.isArray(steps)) {
            steps.forEach(function (step) {
                lastPromise = lastPromise.then(step);
            })
        }
        return lastPromise;
    };

    /**
     * Repeats a call of 'promiseFunction' max 'timesToRepeat' times, checking each time if the execution should be stopped
     * or continued on error by means of 'shouldTryAgainOnError' function. On empty 'shouldTryAgainOnError'
     * continues exactly 'timesToRepeat' times.
     * @param promiseFunction
     * @param timesToRepeat
     * @param shouldTryAgainOnError
     * @returns {*}
     */
    self.repeatPromiseCall = function (promiseFunction, timesToRepeat, shouldTryAgainOnError) {
        if (timesToRepeat > 0) {
            return _repeatPromiseCall(promiseFunction, timesToRepeat, shouldTryAgainOnError);
        }
        else {
            return Q.reject(new MiaError({err: {msg: 'Qext.repeatPromiseCall: Expected timesToRepeat > 0.'}}));
        }
    };

    var _repeatPromiseCall = function (promiseFunction, timesToRepeat, shouldTryAgainOnError, lastErr) {
        if (timesToRepeat > 0) {
            return promiseFunction().catch(function (err) {
                if (shouldTryAgainOnError == null || shouldTryAgainOnError(err)) {
                    return _repeatPromiseCall(promiseFunction, timesToRepeat - 1, shouldTryAgainOnError, err);
                }
                else {
                    return Q.reject(new MiaError(err));
                }
            });
        }
        else {
            return Q.reject(new MiaError(lastErr || {err: {msg: 'Qext.repeatPromiseCall: Exiting on repeat limit with unknown error.'}}));
        }
    };

    /**
     * Wraps node method or function invocation to promise.
     * @param params:: {
     *      obj: [required] object for calling a method or 'this' for binding the function call,
     *      func: [required] object's method name as String or function as Function to be called
     *      options: [optional] {returnAsArray: Boolean, if missing handleded as 'false'}
     *      callback: [optional] callback to call additionally
     * }
     * @param args:: Arguments for the method, as array
     */
    self.applyNodeFunc = function (params, args) {
        if (_.isString(params.func)) {
            return _npost.call(Q(params.obj), params.func, params.options, params.callback, args);
        }
        else if (_.isFunction(params.func)) {
            return _nbind(params.obj, params.func, params.options, params.callback, args);
        }
        else {
            return Q.reject(new MiaError('Wrong call to invokeNodeFuncA'));
        }
    };

    /**
     * Wraps node method or function invocation to promise.
     * @param params:: {
     *      obj: [required] object for calling a method or 'this' for binding the function call,
     *      func: [required] object's method name as String or function as Function to be called
     *      options: [optional] {returnAsArray: Boolean, if missing handleded as 'false'}
     *      callback: [optional] callback to call additionally
     * }
     * @param args:: Arguments for the method, as variadic list of arguments
     */
    self.callNodeFunc = function (params /*...args*/) {
        if (_.isString(params.func)) {
            return _npost.call(Q(params.obj), params.func, params.options, params.callback, Array.prototype.slice.call(arguments, 1));
        }
        else if (_.isFunction(params.func)) {
            return _nbind(params.obj, params.func, params.options, params.callback, Array.prototype.slice.call(arguments, 1));
        }
        else {
            return Q.reject(new MiaError('Wrong call to invokeNodeFuncA'));
        }
    };

    var _npost = function (methodName, options, callback, args) {
        var nodeArgs = Array.prototype.slice.call(args || []);
        var deferred = Q.defer();
        nodeArgs.push(self.makeNodeResolver(deferred, callback, options));
        this.dispatch("post", [methodName, nodeArgs]).catch(deferred.reject);
        return deferred.promise;
    };

    var _nbind = function (thisArg, func, options, callback, args) {
        var nodeArgs = Array.prototype.slice.call(args || []);
        var deferred = Q.defer();
        nodeArgs.push(self.makeNodeResolver(deferred, callback, options));
        function bound() {
            return func.apply(thisArg, arguments);
        }
        Q(bound).fapply(nodeArgs).catch(deferred.reject);
        return deferred.promise;
    };

    /**
     * Takes a Q.deferred object and returns a node-style callback function which wraps the deferred in it.
     * The so created callback can be forwarded to any node-style function. As a result deferred gets resolved
     * or rejected as a callback gets called. Another callback can be attached to the result, which in this case also
     * will be called with all arguments. Setting 'returnAsArray' option makes it possible to handle several return values in the promise.all
     * Otherwise several return values get ignored and only the first argument will be forwarded to the deferred resolution.
     * @param deferred:: deferred to be resolved or rejected
     * @param callback:: optional callback to be chained
     * @param options:: {returnAsArray :: Boolean, if missing handleded as 'false'}
     * @returns {Function}
     */
    self.makeNodeResolver = function (deferred, callback, options) {
        return function (err, data) {
            if (err) {
                deferred.reject(err);
            }
            else {
                if (options && options.returnAsArray === true) {
                    //wraps all arguments to an array
                    deferred.resolve(Array.prototype.slice.call(arguments, 1));
                }
                else {
                    //ignores all arguments except the very first one
                    deferred.resolve(data);
                }
            }
            if (callback) {
                (function (args) {
                    return callback.apply(this, args);
                })(Array.prototype.slice.call(arguments));
            }
        };
    };

    return self;
};

module.exports = new thisModule();
