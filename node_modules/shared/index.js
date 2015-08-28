function thisModule() {
    if (!global.sharedInfo){
        global.sharedInfo = require('./lib/shared.js');
    }
    return global.sharedInfo;
};

module.exports = thisModule();
