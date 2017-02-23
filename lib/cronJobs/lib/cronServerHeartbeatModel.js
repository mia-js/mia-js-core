var _ = require('lodash');
var BaseModel = require("./../../baseModel");

function thisModule() {
    var model = BaseModel.extend({
            data: {
                status: {
                    type: String,
                    default: 'active',
                    index: true
                },
                hostName: {
                    type: String,
                    index: true
                },
                startedAt: {
                    type: Date,
                    index: true
                },
                restartCount: {
                    type: Number,
                    index: true
                },
                isSuspended: {
                    type: Boolean,
                    index: true
                },
                lastStatusUpdateAt: {
                    type: Date,
                    index: true
                }
            },
            compoundIndexes: [
                {
                    fields: ["_id", "status"]
                },
                {
                    fields: ["status", "lastStatusUpdate"]
                }
            ]
        },
        {
            disabled: false, // Enable /disable model
            identity: 'generic-cronServerHeartbeatModel', // Model name
            version: '1.0', // Version number
            created: '2014-01-09T19:00:00', // Creation date
            modified: '2014-01-09T19:00:00', // Last modified date
            collectionName: 'cronServerHeartbeat'
        });

    return model;
};

module.exports = thisModule();
