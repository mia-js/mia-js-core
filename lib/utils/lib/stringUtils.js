var Util = require('util');

function _addHelperMethodsToString() {
    if (!String.isEmpty) {
        String.isEmpty = function (string) {
            return string == null || string.length === 0 || !string.trim();
        };
    }

    if (!String.objToString) {
        String.objToString = function (obj, options) {
            options = options || {showHidden: false, depth: null};
            return Util.inspect(obj, options);
        };
    }
};

_addHelperMethodsToString();
