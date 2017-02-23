/*var Shared = require('./../../shared');
var host = Shared.getCurrentHostId();
if (host == "mobileapp-fe01-prod.p7s1dns.net") {
    console.log("USE HYPERQUEST AS REQUEST MODULE");
    module.exports = require('./lib/hyperquest.js');
    module.exports.V2 = require('./lib/hyperquestV2.js');
}
else {
    console.log("USE DEFAULT REQUEST AS REQUEST MODULE");*/
    module.exports = require('./lib/request.js');
    module.exports.V2 = require('./lib/requestV2.js');
//}
