/**
 *
 *
 */

var _ = require('lodash');
var BaseClass = require("./../../baseClass");
var Utils = require("./../../utils");
var MemberHelpers = Utils.MemberHelpers;
var Shared = require('./../../shared');
var CronJob = require('cron').CronJob;
var CronTime = require('cron').CronTime;
var Q = require('q');
var JobManagementDbConnector = require('./jobManagementDbConnector.js');
var CronJobExecutionModel = require('./cronJobConfigModel.js');
var Logger = require('./../../logger').tag('Cron');

Q.stopUnhandledRejectionTracking();

function thisModule() {

    /**
     * Base class for custom cron job bundle definitions
     */
    var BaseCronJob = BaseClass.extend({
            //==================================
            // Instance members
            //==================================
        },
        {
            //==================================
            // Schema members
            //==================================

            //Example of custom cron job structure:
            //disabled: false, // Enable /disable job definition
            //time: {
            //    hour: '0-23',
            //    minute: '0-59',
            //    second: '0-59',
            //    dayOfMonth: '0-31',
            //    dayOfWeek: '0-7', // (0 or 7 is Sun, or use names)
            //    month: '0-12',   // names are also allowed
            //    timezone: 'CET'
            //},
            //
            //isSuspended: false,
            //debugOutput: false,
            //allowedHosts: ['hostName1', 'hostName2'],
            //
            //maxInstanceNumberTotal: 3,
            //maxInstanceNumberPerServer: 2,
            //
            //identity: 'testJob1', // Unique job name
            //
            //worker: function () {
            //    process.stdout.write("1");
            //    return Q();
            //},

            staticConstructor: function () {
                var self = this;

                var _cronJobTrigger;
                var _actualJobConfig;
                var _serverUniqueId;
                var _hostId = Shared.getCurrentHostId();

                self.getUniqueServerId = function () {
                    return _serverUniqueId;
                };

                self.setUniqueServerId = function (serverUniqueId) {
                    _serverUniqueId = serverUniqueId;
                };

                var _isDbInitialized = false;

                var _presetConfigToDbConfig = function (jobConfig) {
                    return {
                        allowedHosts: jobConfig.allowedHosts,
                        time: jobConfig.time,
                        isSuspended: jobConfig.isSuspended,
                        debugOutput: jobConfig.debugOutput,
                        maxInstanceNumberTotal: jobConfig.maxInstanceNumberTotal,
                        maxInstanceNumberPerServer: jobConfig.maxInstanceNumberPerServer,
                        forceRun: jobConfig.forceRun
                    };
                };

                var _parsePresetConfig = function () {
                    return {
                        identity: self.identity,
                        allowedHosts: self.allowedHosts,
                        time: self.time,
                        isSuspended: self.isSuspended,
                        debugOutput: self.debugOutput,
                        maxInstanceNumberTotal: self.maxInstanceNumberTotal,
                        maxInstanceNumberPerServer: self.maxInstanceNumberPerServer,
                        forceRun: self.forceRun
                    };
                };

                var _parseDbConfig = function (jobInfo) {
                    var config = _.clone(jobInfo.config);
                    config.identity = jobInfo.typeName;
                    return config;
                };

                var _getCronPattern = function () {
                    var time = _actualJobConfig.time;
                    return time.second + " "
                        + time.minute + " "
                        + time.hour + " "
                        + time.dayOfMonth + " "
                        + time.month + " "
                        + time.dayOfWeek;
                };

                self.getConfigOutput = function () {
                    var hosts = _actualJobConfig.allowedHosts || [];
                    return 'pattern: ' + _getCronPattern()
                        + ', on hosts: [' + (hosts.length > 0 ? hosts : '(any)')
                        + '], max instances on this server: ' + _actualJobConfig.maxInstanceNumberPerServer + ', max overall: ' + _actualJobConfig.maxInstanceNumberTotal
                        + ', isActive: ' + _isToBeStarted()
                        + ', debugOutput: ' + _actualJobConfig.debugOutput
                        + ', forceRun: ' + _actualJobConfig.forceRun;
                };

                self.initializeJob = function (serverUniqueId) {
                    if (!_isDbInitialized) {
                        self.setUniqueServerId(serverUniqueId);
                        //write info to DB
                        return CronJobExecutionModel.validate(_parsePresetConfig()).fail(function (err) {
                            Logger.error("'" + self.identity + "' has erroneous preset config");
                            return Q.reject(err);
                        }).then(function (validatedConfig) {
                            return JobManagementDbConnector.getOrCreateDbJobEntry(self.identity, _presetConfigToDbConfig(validatedConfig));
                        }).then(function (jobInfo) {
                            var dbConfig = _parseDbConfig(jobInfo);
                            return CronJobExecutionModel.validate(dbConfig).then(function (dbConfig) {
                                return Q(dbConfig);
                            }, function (err) {
                                Logger.error("'" + self.identity + "' has erroneous database config. Ignoring db config and using preset config instead.");
                                return Q(_parsePresetConfig());
                            }).then(function (jobConfig) {
                                _actualJobConfig = jobConfig;
                                _isDbInitialized = true;
                                return _startOrRestartTimer();
                            }).then(function () {
                                //Logger('info', "Cron: '" + self.identity + "' is loaded with " + self.getConfigOutput());
                                return Q();
                            });
                        });
                    }
                    else {
                        return Q();
                    }
                };

                var _isToBeStarted = function () {
                    return _actualJobConfig.isSuspended !== true;
                };

                var _getTimezone = function () {
                    return MemberHelpers.getPathPropertyValue(_actualJobConfig, 'time.timezone');
                };

                self.updateJob = function () {
                    if (_isDbInitialized) {
                        return JobManagementDbConnector.getDbJobEntry(self.identity).then(function (jobInfo) {
                            var dbConfig = _parseDbConfig(jobInfo);
                            return CronJobExecutionModel.validate(dbConfig).then(function (dbConfig) {
                                return Q(dbConfig);
                            }, function (err) {
                                Logger.error("'" + self.identity + "' has erroneous database config. Ignoring db config and using preset config instead.");
                                return Q(_parsePresetConfig());
                            }).then(function (jobConfig) {
                                if (_compareConfigs(_actualJobConfig, jobConfig) != 0) {
                                    _actualJobConfig = jobConfig;
                                    _startOrRestartTimer();
                                }
                                return Q();
                            });
                        });
                    }
                    else {
                        return Q();
                    }
                };

                var _compareConfigs = function (jobConfigA, jobConfigB) {
                    if (jobConfigA.isSuspended != jobConfigB.isSuspended
                        || jobConfigA.maxInstanceNumberTotal != jobConfigB.maxInstanceNumberTotal
                        || jobConfigA.maxInstanceNumberPerServer != jobConfigB.maxInstanceNumberPerServer
                        || jobConfigA.time.hour != jobConfigB.time.hour
                        || jobConfigA.time.minute != jobConfigB.time.minute
                        || jobConfigA.time.second != jobConfigB.time.second
                        || jobConfigA.time.dayOfMonth != jobConfigB.time.dayOfMonth
                        || jobConfigA.time.dayOfWeek != jobConfigB.time.dayOfWeek
                        || jobConfigA.time.month != jobConfigB.time.month
                        || jobConfigA.time.timezone != jobConfigB.time.timezone
                        || jobConfigA.debugOutput != jobConfigB.debugOutput
                        || jobConfigA.forceRun != jobConfigB.forceRun) {
                        return 1;
                    }
                    else {
                        var allowedHostsA = jobConfigA.allowedHosts || [];
                        var allowedHostsB = jobConfigB.allowedHosts || [];
                        if (allowedHostsA.length != allowedHostsB.length) {
                            return 1;
                        }
                        for (var i = 0; i < allowedHostsA.length; ++i) {
                            if (allowedHostsA[i] != allowedHostsB[i]) {
                                return 1;
                            }
                        }
                        return 0;
                    }
                };

                var _canStartOnThisServer = function () {
                    if (!_actualJobConfig) {
                        return false;
                    }
                    else if (!_actualJobConfig.allowedHosts || _actualJobConfig.allowedHosts.length == 0) {
                        return true;
                    }
                    else {
                        return _actualJobConfig.allowedHosts.indexOf(_hostId) != -1;
                    }
                }

                var _startOrRestartTimer = function () {
                    if (!_actualJobConfig) {
                        return Q.reject("Cron job db connection was not initialized");
                    }
                    else {
                        if (!_canStartOnThisServer()) {
                            Logger.error("'" + self.identity + "' is not allowed to run on this host");
                            return Q();
                        }
                        else {
                            if (!_cronJobTrigger) {
                                return Q().then(function () {
                                    return self.initialize ? self.initialize(self) : Q();
                                }).then(function () {
                                    _cronJobTrigger = new CronJob(_getCronPattern(),
                                        _workerWrapper,
                                        null,
                                        _isToBeStarted(),
                                        _getTimezone()
                                    );
                                    Logger.info("'" + self.identity + "' is started with " + self.getConfigOutput());
                                    return Q();
                                });
                            }
                            else {
                                var time = new CronTime(_getCronPattern(), _getTimezone());
                                _cronJobTrigger.setTime(time); //stops job also
                                _setRunState(_isToBeStarted());
                                Logger.info("'" + self.identity + "' detected config update with " + self.getConfigOutput());
                                return Q();
                            }
                        }
                    }
                };

                var _getStats = function (jobDoc, serverUniqueId) {
                    var runningOverallCount = 0, runningThisServerCount = 0;
                    if (jobDoc && jobDoc.runningJobsOverall) {
                        runningOverallCount = jobDoc.runningJobsOverall.length;
                    }
                    if (jobDoc && jobDoc.runningJobsByServer) {
                        jobDoc.runningJobsByServer.some(function (value) {
                            if (value.serverId && value.serverId.equals(serverUniqueId) && value.jobs) {
                                runningThisServerCount = value.jobs.length;
                                return true;
                            }
                        });
                    }

                    return {
                        runningOverallCount: runningOverallCount,
                        runningThisServerCount: runningThisServerCount
                    };
                };

                var _informAboutMissingServerOnce = false;
                var _hasInformedAboutMissingServer = false;
                self.onServerDeletedHandler = function(err) {
                    if (_actualJobConfig.debugOutput === true && _informAboutMissingServerOnce && !_hasInformedAboutMissingServer) {
                        Logger.error("'" + self.identity + "' won't start, since the server is either paused or the server entry was removed from DB.");
                        _informAboutMissingServerOnce = false;
                        _hasInformedAboutMissingServer = true;
                    }
                    return Q.reject(err);
                };

                var _workerWrapper = function () {
                    //var stateOnStart = _.clone(_actualJobConfig);
                    var timeOnStart = new Date();

                    var serverUniqueId = self.getUniqueServerId();

                    return JobManagementDbConnector.validateDbServerEntry(serverUniqueId).fail(function (err) {
                        _informAboutMissingServerOnce = true;
                        return self.onServerDeletedHandler(err);
                    }).then(function () {
                        _hasInformedAboutMissingServer = false;
                        return JobManagementDbConnector.startNewJob(self.identity,
                            serverUniqueId,
                            _hostId,
                            _actualJobConfig.maxInstanceNumberPerServer,
                            _actualJobConfig.maxInstanceNumberTotal).then(function (result) {
                                var jobId = result.jobId;
                                var jobDoc = result.jobDoc;
                                if (_actualJobConfig.debugOutput === true) {
                                    _outputJobStats(jobDoc, serverUniqueId, true);
                                }
                                return Q().then(function () {
                                    return self.worker(self, _actualJobConfig);
                                }).finally(function () {
                                    var timeLapsed = new Date() - timeOnStart;
                                    return JobManagementDbConnector.stopJob(jobId, timeLapsed).then(function (result) {
                                            if (_actualJobConfig.debugOutput === true) {
                                                if (result > 0) {
                                                    JobManagementDbConnector.getDbJobEntry(self.identity).then(function (jobInfo) {
                                                        _outputJobStats(jobInfo, serverUniqueId, false, timeLapsed);
                                                    }).done();
                                                }
                                                else {
                                                    Logger.error("'" + self.identity + "' could not find/remove entry from db after finishing job instance.");
                                                }
                                            }
                                        });
                                });
                            });
                    });
                };

                var _outputJobStats = function (jobDoc, serverUniqueId, started, timeLapsed) {
                    var stats = _getStats(jobDoc, serverUniqueId);
                    Logger.info("'" + self.identity + (started ? "' +1" : "' -1") + " active instances on this server: " + stats.runningThisServerCount + '/' + _actualJobConfig.maxInstanceNumberPerServer
                    + ', overall: ' + stats.runningOverallCount + '/' + _actualJobConfig.maxInstanceNumberTotal + (!started ? (', time lapsed: ' + timeLapsed + 'ms') : ''));
                };

                var _isRunning = function () {
                    return _cronJobTrigger && _cronJobTrigger.running;
                };

                var _stop = function () {
                    if (_isRunning()) {
                        //stop job
                        _cronJobTrigger.stop();
                    }
                };

                var _start = function () {
                    if (!_isRunning()) {
                        //stop job
                        _cronJobTrigger.start();
                    }
                };

                var _setRunState = function (runState) {
                    if (runState === true) {
                        _start();
                    }
                    else {
                        _stop();
                    }
                };
            }
        });

    return BaseCronJob;
};

module.exports = thisModule();