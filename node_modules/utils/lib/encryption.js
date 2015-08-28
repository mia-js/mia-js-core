/**
 * Encryption functions
 * @param app
 */

var crypto = require('crypto');

function thisModule() {
    var self = this;

    /**
     * Generate MD5 hash
     * @param value
     * @returns md5(hash)
     */
    self.md5 = function (value) {
        if (value) {
            return crypto.createHash('md5').update(value).digest('hex');
        }
        else {
            return false;
        }
    };

    /**
     * Generate random hash value
     * @returns {*}
     */
    self.randHash = function () {
        return (crypto.createHash('sha256')).update(Math.random().toString()).digest('hex');
    };

    return self;
};

module.exports = new thisModule();