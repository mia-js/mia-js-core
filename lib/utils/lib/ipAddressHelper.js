/**
 * Determine Clients IP Address
 * @param err
 * @returns {*}
 */

function thisModule() {
    var self = this;

    /**
     * Generate random hash value
     * @returns {*}
     */
    self.getClientIP = function (req) {
        req = req || {};
        req.connection = req.connection || {};
        req.socket = req.socket || {};
        req.client = req.client || {};
        var ipString = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress || req.client.remoteAddress || req.ip || "";
        var ips = ipString.split(",");

        if (ips.length > 0) {
            return ips[0];
        }
        else {
            return;
        }
    };

    return self;
};

module.exports = new thisModule();
