const Q = require('q');

function thisModule() {
    var self = this;

    /**
     * Calls a native promise and returns it as Q promise
     * @param func
     * @returns {*}
     */
    self.toQ = (func) => {
        return Q().then(()=> {
            return func.then(result => {
                return Q(result);
            }).catch(err => {
                return Q.reject(err);
            });
        })
    };

    /**
     * Calls a Q promise and returns it as native promise
     * @param func
     * @returns {Promise}
     * @constructor
     */
    self.QtoNative = (func) => {
        return new Promise((resolve, reject) => {
            return func.then(result => {
                resolve(result)
            }).fail(err => {
                reject(err);
            });
        })
    };

    return self;
};

module.exports = new thisModule();
