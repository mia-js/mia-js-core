var _ = require('lodash')
    , Shared = require('./../../shared')
    , ServerHeartbeatModel = require('./cronServerHeartbeatModel.js')
    , CronJobExecutionModel = require('./cronJobExecutionModel.js')
    , Logger = require('./../../logger').tag('cronjob-management')
    , Utils = require('./../../utils')
    , Encryption = Utils.Encryption
    , Q = require('q')
    , MiaError = require('../../errorHandler/lib/error');

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
            } else {
                return Q.reject(new MiaError('Cannot insert new server info for crons into DB. Crons will be disabled on this server.'));
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
            Logger.debug('doHeartbeat', data);
            var serverInfo = data.value;
            if (!serverInfo) {
                return Q.reject(new MiaError('heartbeat not possible'));
            } else {
                return Q(serverInfo);
            }
        });
    };

    self.getOrCreateDbJobEntry = function (jobTypeName, cronConfig) {
        if (cronConfig.allowedHosts == null || cronConfig.allowedHosts.length == 0) {
            var env = Shared.config('environment');
            cronConfig.allowedHosts = env && env.cronJobs && env.cronJobs.allowedHosts ? env.cronJobs.allowedHosts : [];
        }

        if (cronConfig.environment == null || cronConfig.environment.length == 0) {
            var env = Shared.config('environment');
            cronConfig.environment = env && env.cronJobs && env.cronJobs.environment ? env.cronJobs.environment : [];
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
                doc.createdAt = parseInt((new Date().getTime() / 1000).toFixed(0))
                return CronJobExecutionModel.insertOne(doc).then(function (data) {
                    var jobInfo = data.ops;
                    if (jobInfo) {
                        return Q(jobInfo[0]);
                    } else {
                        return Q.reject(new MiaError('Error inserting job description to db'));
                    }
                });
            } else {
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
        }).catch(function (err) {
            return Q.reject(new MiaError(err));
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
                }, {
                    $or: [{
                        'config.environment': Shared.config("environment.mode")
                    }, {
                        'config.environment': {$exists: false}
                    }, {
                        'config.environment': {$size: 0}
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
                    return Q.reject(new MiaError('Could not start job'));
                } else {
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
                'config.forceRun': false,
                'config.stopJob': false
            }
        }, {
            validate: false
        }).then(function (data) {
            return Q(data.result && data.result.nModified ? data.result.nModified : 0);
        }).catch(function (err) {
            //TODO: Recycle jobs later (persit id) when job should be stopped but db is not available while stopping job
            return Q.reject(new MiaError(err));
        });
    };

    self.unsetStopFlag = function () {
        return CronJobExecutionModel.findOneAndUpdate({typeName: self.identity}, {$set: {'config.stopJob': false}});
    };

    self.cleanJobsOfDeadServers = function (heartbeatInterval) {
        let deadServersCount = 0;
        return _identifyDeadServers(heartbeatInterval)
            .then(function (count) {
                deadServersCount = count;
                return _killAllDeadJobs();
            })
            .then(_removeUnkownServerIds)
            .then(function () {
                return deadServersCount;
            })
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
        }).catch(function (err) {
            return Q.reject(new MiaError(err));
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
                return _removeAllJobsOfUnknownServer(serverIds);
            });
        });
    };

    var _removeServer = function (serverId) {
        return ServerHeartbeatModel.deleteOne({
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
                'config.forceRun': false,
                'config.stopJob': false
            }
        }, {
            validate: false,
            w: 1
        }).then(function (data) {
            return Q(data.result && data.result.nModified ? data.result.nModified : 0);
        }).catch(function (err) {
            return Q.reject(new MiaError(err));
        });
    };

    var _removeAllJobsOfUnknownServer = function (serverIds) {
        return CronJobExecutionModel.updateMany({
            $or: [
                {runningJobsByServer: {$elemMatch: {serverId: {$nin: serverIds}}}},
                {runningJobsOverall: {$elemMatch: {serverId: {$nin: serverIds}}}}
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
                'config.forceRun': false,
                'config.stopJob': false
            }
        }, {
            validate: false,
            w: 1
        }).then(function (data) {
            return Q(data.result && data.result.nModified ? data.result.nModified : 0);
        }).catch(function (err) {
            return Q.reject(new MiaError(err));
        });
    };

    return self;
};

module.exports = new thisModule();
