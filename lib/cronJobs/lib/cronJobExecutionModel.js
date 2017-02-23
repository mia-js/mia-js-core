var _ = require('lodash');
var BaseModel = require("./../../baseModel");

function thisModule() {
    var model = BaseModel.extend({
            data: {
                typeName: {
                    type: String,
                    required: true,
                    unique: true
                },
                config: {
                    maxInstanceNumberTotal: {
                        type: Number
                    },
                    maxInstanceNumberPerServer: {
                        type: Number
                    },
                    allowedHosts: {
                        type: Array,
                        subType: String,
                        index: true
                    },
                    time: {
                        hour: {
                            type: String,
                            required: true
                        },
                        minute: {
                            type: String,
                            required: true
                        },
                        second: {
                            type: String,
                            required: true
                        },
                        dayOfMonth: {
                            type: String,
                            required: true
                        },
                        dayOfWeek: {
                            type: String,
                            required: true
                        },
                        month: {
                            type: String,
                            required: true
                        },
                        timezone: {
                            type: String,
                            required: true
                        }
                    },
                    isSuspended: {
                        type: Boolean,
                        default: false,
                        index: true
                    },
                    debugOutput: {
                        type: Boolean,
                        default: false,
                        index: true
                    },
                    forceRun: {
                        type: Boolean,
                        default: false
                    }
                },
                runningJobsByServer: [{
                    serverId: {
                        index: true
                    },
                    jobs: [{
                        id: {
                            type: String,
                            required: true,
                            index: true
                        }
                    }]
                }],
                runningJobsOverall: [{
                    id: {
                        type: String,
                        required: true,
                        index: true
                    },
                    serverId: {
                        index: true
                    },
                    startedAt: {
                        type: Date,
                        index: true
                    }
                }],
                stats: {
                    lastStarted: {
                        serverId: {
                            type: String
                        },
                        hostName: {
                            type: String
                        },
                        time: {
                            type: Date
                        }
                    },
                    timesStarted: {
                        type: Number
                    },
                    timesFinished: {
                        type: Number
                    },
                    totalExecutionTime: {
                        type: Number
                    }
                }
            },
            compoundIndexes: [
                {
                    fields: ["typeName", "runningJobsByServer.serverId"],
                    unique: true
                },
                {
                    fields: ["typeName", "runningJobsByServer.serverId", "runningJobsByServer.jobs.id"],
                    unique: true
                },
                {
                    fields: ["typeName", "runningJobsOverall.serverId", "runningJobsOverall.id"],
                    unique: true
                }
            ]
        },
        {
            disabled: false, // Enable /disable model
            identity: 'generic-cronJobExecutionModel', // Model name
            version: '1.0', // Version number
            created: '2014-01-09T19:00:00', // Creation date
            modified: '2017-02-13T12:00:00', // Last modified date
            collectionName: 'cronJobExecution'
        });

    return model;
};

module.exports = thisModule();
