_ = require('lodash');

function thisModule() {
    var self = this;

    /**
     * Identifies and returns the callback argument, which is supposed to be the last argument in the list and to be a function
     * If no callback argument is present, adds an empty callback to the end of the arguments list.
     * @param args
     * @returns {{callback: *, arguments: Array}}
     */
    self.prepareCallback = function (args) {
        args = args || [];
        args = Array.prototype.slice.call(args, 0);

        var callback;
        for (var i = args.length - 1; i >= 0; --i) {
            if (args[i] == null) {
                args.pop();
            }
        }

        if (args.length > 0) {
            //trim 'null' args
            callback = _.isFunction(args[args.length - 1]) ? args[args.length - 1] : null;
        }

        //if (!callback) {
        //    //add dummy callback
        //    callback = function () {
        //    };
        //    args.push(callback);
        //}

        return {
            callback: callback,
            arguments: args
        };
    };

    /**
     * Interpretes and prepares 2 optional arguments
     * @param [options]
     * @param [callback]
     */
    self.prepareArguments = function (options, callback) {
        if (_.isFunction(options)) {
            callback = options;
            options = {};
        }

        if (options == null) {
            options = {};
        }

        //if (!_.isFunction(callback)) {
        //    callback = function () {
        //    };
        //}

        return {
            options: options,
            callback: callback
        };
    };

    self.getLastArgumentIfItIsAFunction = function (argsArray) {
        if (argsArray.length > 0 && _.isFunction(argsArray[argsArray.length - 1])) {
            return argsArray[argsArray.length - 1];
        }
    };

    return self;
};

module.exports = new thisModule();