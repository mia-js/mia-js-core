var _ = require('lodash')
    , Shared = require('./../../shared')
    , ServerHeartbeatModel = require('./cronServerHeartbeatModel.js')
    , CronJobExecutionModel = require('./cronJobExecutionModel.js')
    , Utils = require('./../../utils')
    , Encryption = Utils.Encryption
    , Q = require('q');

Q.stopUnhandledRejectionTracking();

function thisModule() {
    var self = this;

    var _statusNoHeartbeat = 'no heartbeat';
    var _statusActive = 'active';

    self.registerNewServer = function (hostName, restartCount) {
        var now = new Date();
        return ServerHeartbeatModel.insertOne({
            status: _statusActive,
            hostName: hostName,
            startedAt: now,
            isSuspended: false,
            restartCount: restartCount,
            lastStatusUpdateAt: now
        }).then(function (data) {
            var serverInfo = data.ops;
            if (serverInfo) {
                return Q(serverInfo[0]);
            }
            else {
                return Q.reject('Cannot insert new server info for crons into DB. Crons will be disabled on this server.');
            }
        });
    };

    self.validateDbServerEntry = function (serverUniqueId) {
        return ServerHeartbeatModel.findOne({
            _id: serverUniqueId,
            status: _statusActive,
            isSuspended: {$ne: true}
        }).then(function (serverInfo) {
            return serverInfo ? Q() : Q.reject();
        });
    };

    self.getDbServerEntry = function (serverUniqueId) {
        return ServerHeartbeatModel.findOne({
            _id: serverUniqueId
        });
    };

    self.doHeartbeat = function (serverId) {
        return ServerHeartbeatModel.findOneAndUpdate({
            _id: serverId,
            status: _statusActive
        }, {
            $set: {
                'lastStatusUpdateAt': new Date()
            }
        }, {
            returnOriginal: false
        }).then(function (data) {
            var serverInfo = data.value;
            if (!serverInfo) {
                return Q.reject('heartbeat not possible');
            }
            else {
                return Q(serverInfo);
            }
        });
    };

    self.getOrCreateDbJobEntry = function (jobTypeName, cronConfig) {
        if (cronConfig.allowedHosts == null || cronConfig.allowedHosts.length == 0) {
            var env = Shared.config('environment');
            cronConfig.allowedHosts = env && env.cronJobs && env.cronJobs.allowedHosts ? env.cronJobs.allowedHosts : [];
        }

        return _getOrCreateDbJobEntry(jobTypeName, {
            config: cronConfig,
            runningJobsByServer: []
        });
    };

    self.getDbJobEntry = function (jobTypeName) {
        return CronJobExecutionModel.findOne({
            typeName: jobTypeName
        });
    };

    var _getOrCreateDbJobEntry = function (jobTypeName, initializationDoc) {
        return CronJobExecutionModel.findOne({
            typeName: jobTypeName
        }).then(function (jobInfo) {
            if (!jobInfo) {
                var doc = _.clone(initializationDoc);
                doc.typeName = jobTypeName;
                return CronJobExecutionModel.insertOne(doc).then(function (data) {
                    var jobInfo = data.ops;
                    if (jobInfo) {
                        return Q(jobInfo[0]);
                    }
                    else {
                        return Q.reject('Error inserting job description to db');
                    }
                });
            }
            else {
                return Q(jobInfo);
            }
        });
    };

    self.addServerEntryToJobDocument = function (jobTypeName, serverId) {
        return CronJobExecutionModel.findOneAndUpdate({
            typeName: jobTypeName,
            runningJobsByServer: {
                $not: {
                    $elemMatch: {
                        serverId: serverId
                    }
                }
            }
        }, {
            $push: {
                runningJobsByServer: {
                    serverId: serverId,
                    jobs: []
                }
            }
        }, {
            returnOriginal: false
        }).then(function (data) {
            return data.value;
        }).fail(function (err) {
            return Q.reject(err);
        });
    };

    self.startNewJob = function (jobTypeName, serverId, hostName, maxJobsPerServer, maxJobsTotal) {
        var jobId = Encryption.randHash();
        return self.addServerEntryToJobDocument(jobTypeName, serverId).then(function () {
            var query = {
                $and: [{
                    typeName: jobTypeName,
                    'config.isSuspended': false,
                    runningJobsByServer: {
                        $elemMatch: {
                            serverId: serverId
                        }
                    }
                }, {
                    $or: [{
                        'config.allowedHosts': hostName
                    }, {
                        'config.allowedHosts': {$exists: false}
                    }, {
                        'config.allowedHosts': {$size: 0}
                    }]
                }]
            };

            if (maxJobsPerServer && maxJobsPerServer != 0) {
                var arraySizeQueryPerServer = 'jobs.' + (maxJobsPerServer - 1);
                query['$and'][0]['runningJobsByServer']['$elemMatch'][arraySizeQueryPerServer] = {$exists: false};
            }

            if (maxJobsTotal && maxJobsTotal != 0) {
                var arraySizeQueryTotal = 'runningJobsOverall.' + (maxJobsTotal - 1);
                query['$and'][0][arraySizeQueryTotal] = {$exists: false};
            }

            var now = new Date();
            return CronJobExecutionModel.findOneAndUpdate(query, {
                $set: {
                    'stats.lastStarted.serverId': serverId,
                    'stats.lastStarted.hostName': hostName,
                    'stats.lastStarted.time': now
                },
                $inc: {
                    'stats.timesStarted': 1
                },
                $push: {
                    "runningJobsByServer.$.jobs": {
                        id: jobId
                    },
                    runningJobsOverall: {
                        id: jobId,
                        serverId: serverId,
                        startedAt: now
                    }
                }
            }, {
                returnOriginal: false
            }).then(function (data) {
                var jobDoc = data.value;
                if (!jobDoc) {
                    return Q.reject('Could not start job');
                }
                else {
                    return Q({jobId: jobId, jobDoc: jobDoc});
                }
            });
        });
    };

    self.stopJob = function (jobId, timeLapsed) {
        return CronJobExecutionModel.updateMany({
            'runningJobsByServer.jobs.id': jobId
        }, {
            $inc: {
                'stats.timesFinished': 1,
                'stats.totalExecutionTime': timeLapsed
            },
            $pull: {
                runningJobsOverall: {
                    id: jobId
                },
                'runningJobsByServer.$.jobs': {
                    id: jobId
                }
            },
            $set: {
                'config.forceRun': false
            }
        }, {
            validate: false
        }).then(function (data) {
            return Q(data.result && data.result.nModified ? data.result.nModified : 0);
        }).fail(function (err) {
            //TODO: Recycle jobs later (persit id) when job should be stopped but db is not available while stopping job
            return Q.reject(err);
        });
    };

    self.cleanJobsOfDeadServers = function (heartbeatInterval) {
        return _identifyDeadServers(heartbeatInterval).then(_killAllDeadJobs).then(_removeUnkownServerIds);
    };

    var _identifyDeadServers = function (heartbeatInterval) {
        var dateTo = new Date(Date.now() - heartbeatInterval);
        return ServerHeartbeatModel.updateMany({
            status: _statusActive,
            lastStatusUpdateAt: {$lt: dateTo}
        }, {
            $set: {
                status: _statusNoHeartbeat,
                lastStatusUpdateAt: new Date()
            }
        }, {
            validate: false
        }).then(function (data) {
            return Q(data.result && data.result.nModified ? data.result.nModified : 0);
        }).fail(function (err) {
            return Q.reject(err);
        });
    };

    var _killAllDeadJobs = function () {
        return ServerHeartbeatModel.find({
            status: _statusNoHeartbeat
        }).then(function (cursor) {
            return Q.ninvoke(cursor, 'toArray').then(function (servers) {
                return Q(servers.map(function (value) {
                    return _removeAllJobsOfServer(value._id).then(function () {
                        return _removeServer(value._id).then(function () {
                            return Q(value._id);
                        });
                    })
                }));
            });
        }).then(function (promises) {
            return Q.allSettled(promises);
        });
    };

    // Remove unknown serverIds from jobslist, can happen while server restart
    var _removeUnkownServerIds = function () {
        return ServerHeartbeatModel.find({
            status: _statusActive
        }).then(function (cursor) {
            return Q.ninvoke(cursor, 'toArray').then(function (servers) {
                var serverIds = [];
                servers.map(function (value) {
                    serverIds.push(value._id);
                });
                return _removeAllJobsOfUnknownServer(serverIds).then(function () {
                    return Q();
                });
            });
        }).then(function (promises) {
            return Q.allSettled(promises);
        });
    };

    var _removeServer = function (serverId) {
        return ServerHeartbeatModel.removeOne({
            _id: serverId
        });
    };

    var _removeAllJobsOfServer = function (serverId) {
        return CronJobExecutionModel.updateMany({
            $or: [
                {'runningJobsOverall.serverId': serverId},
                {'runningJobsByServer.serverId': serverId}
            ]
        }, {
            $pull: {
                runningJobsOverall: {
                    serverId: serverId
                },
                runningJobsByServer: {
                    serverId: serverId
                }
            },
            $set: {
                'config.forceRun': false
            }
        }, {
            validate: false,
            w: 1
        }).then(function (data) {
            return Q(data.result && data.result.nModified ? data.result.nModified : 0);
        }).fail(function (err) {
            return Q.reject(err);
        });
    };

    var _removeAllJobsOfUnknownServer = function (serverIds) {
        return CronJobExecutionModel.updateMany({
            $and: [
                {'runningJobsOverall.serverId': {$nin: serverIds}},
                {'runningJobsByServer.serverId': {$nin: serverIds}}
            ]
        }, {
            $pull: {
                runningJobsOverall: {
                    serverId: {$nin: serverIds}
                },
                runningJobsByServer: {
                    serverId: {$nin: serverIds}
                }
            },
            $set: {
                'config.forceRun': false
            }
        }, {
            validate: false,
            w: 1
        }).then(function (data) {
            return Q(data.result && data.result.nModified ? data.result.nModified : 0);
        }).fail(function (err) {
            return Q.reject(err);
        });
    };

    return self;
};

module.exports = new thisModule();