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
var MiaError = require('../../errorHandler/lib/error');

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

                self.STOP_CRONJOB_CODE = 'STOP_CRONJOB_CODE';

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
                        environment: jobConfig.environment,
                        time: jobConfig.time,
                        isSuspended: jobConfig.isSuspended,
                        debugOutput: jobConfig.debugOutput,
                        maxInstanceNumberTotal: jobConfig.maxInstanceNumberTotal,
                        maxInstanceNumberPerServer: jobConfig.maxInstanceNumberPerServer,
                        forceRun: jobConfig.forceRun,
                        stopJob: jobConfig.stopJob
                    };
                };

                self.parsePresetConfig = function () {
                    return {
                        identity: self.identity,
                        allowedHosts: self.allowedHosts,
                        environment: self.environment,
                        time: self.time,
                        isSuspended: self.isSuspended,
                        debugOutput: self.debugOutput,
                        maxInstanceNumberTotal: self.maxInstanceNumberTotal,
                        maxInstanceNumberPerServer: self.maxInstanceNumberPerServer,
                        forceRun: self.forceRun,
                        stopJob: self.stopJob
                    };
                };

                var _parseDbConfig = function (jobInfo) {
                    var config = _.clone(jobInfo.config);
                    config.identity = jobInfo.typeName;
                    return config;
                };

                var _getCronPattern = function (randomize = false) {
                    var time = _actualJobConfig.time;
                    var second = randomize ? time.second.replace(/RANDOM/g, () => _getRandomInt(0, 60)) : time.second;
                    return second + " "
                        + time.minute + " "
                        + time.hour + " "
                        + time.dayOfMonth + " "
                        + time.month + " "
                        + time.dayOfWeek;
                };

                /**
                 * Returns a random integer between min (inclusive) and max (inclusive).
                 * The value is no lower than min (or the next integer greater than min
                 * if min isn't an integer) and no greater than max (or the next integer
                 * lower than max if max isn't an integer).
                 * Using Math.round() will give you a non-uniform distribution!
                 */
                var _getRandomInt = function (min, max) {
                    min = Math.ceil(min);
                    max = Math.floor(max);
                    return Math.floor(Math.random() * (max - min + 1)) + min;
                };

                self.getConfigOutput = function () {
                    var hosts = _actualJobConfig.allowedHosts || [];
                    var environments = _actualJobConfig.environment || [];
                    return 'pattern: ' + _getCronPattern()
                        + ', on hosts: [' + (hosts.length > 0 ? hosts : '(any)')
                        + '], max instances on this server: ' + _actualJobConfig.maxInstanceNumberPerServer + ', max overall: ' + _actualJobConfig.maxInstanceNumberTotal
                        + ', isActive: ' + _isToBeStarted()
                        + ', debugOutput: ' + _actualJobConfig.debugOutput
                        + ', environment: [' + (environments.length > 0 ? environments : '(any)')
                        + '], forceRun: ' + _actualJobConfig.forceRun
                        + ', stopJob: ' + _actualJobConfig.stopJob
                };

                self.initializeJob = function (serverUniqueId) {
                    if (!_isDbInitialized) {
                        self.setUniqueServerId(serverUniqueId);
                        //write info to DB
                        return CronJobExecutionModel.validate(self.parsePresetConfig()).catch(function (err) {
                            Logger.error("'" + self.identity + "' has erroneous preset config");
                            return Q.reject(new MiaError(err));
                        }).then(function (validatedConfig) {
                            return JobManagementDbConnector.getOrCreateDbJobEntry(self.identity, _presetConfigToDbConfig(validatedConfig));
                        }).then(function (jobInfo) {
                            var dbConfig = _parseDbConfig(jobInfo);
                            return CronJobExecutionModel.validate(dbConfig).then(function (dbConfig) {
                                return Q(dbConfig);
                            }, function (err) {
                                Logger.error("'" + self.identity + "' has erroneous database config. Ignoring db config and using preset config instead.");
                                return Q(self.parsePresetConfig());
                            }).then(function (jobConfig) {
                                _actualJobConfig = jobConfig;
                                _isDbInitialized = true;
                                return _startOrRestartTimer(true);
                            }).then(function () {
                                //Logger('info', "Cron: '" + self.identity + "' is loaded with " + self.getConfigOutput());
                                return Q();
                            });
                        });
                    } else {
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
                        _getParsedConfig()
                            .then(function (jobConfig) {
                                if (_compareConfigs(_actualJobConfig, jobConfig) != 0) {
                                    _actualJobConfig = jobConfig;
                                    _startOrRestartTimer();
                                }
                                return Q();
                            });
                    } else {
                        return Q();
                    }
                };

                var _getParsedConfig = function () {
                    return JobManagementDbConnector.getDbJobEntry(self.identity).then(function (jobInfo) {
                        var dbConfig = _parseDbConfig(jobInfo);
                        return CronJobExecutionModel.validate(dbConfig).then(function (dbConfig) {
                            return Q(dbConfig);
                        }, function (err) {
                            Logger.error("'" + self.identity + "' has erroneous database config. Ignoring db config and using preset config instead.");
                            return Q(self.parsePresetConfig());
                        });
                    });
                };

                var _compareConfigs = function (jobConfigA, jobConfigB) {
                    var maxInstanceNumberTotalNaN = _.isNaN(jobConfigA.maxInstanceNumberTotal) && _.isNaN(jobConfigB.maxInstanceNumberTotal);
                    var maxInstanceNumberPerServerNaN = _.isNaN(jobConfigA.maxInstanceNumberPerServer) && _.isNaN(jobConfigB.maxInstanceNumberPerServer);
                    if (jobConfigA.isSuspended != jobConfigB.isSuspended
                        || (!maxInstanceNumberTotalNaN && jobConfigA.maxInstanceNumberTotal != jobConfigB.maxInstanceNumberTotal)
                        || (!maxInstanceNumberPerServerNaN && jobConfigA.maxInstanceNumberPerServer != jobConfigB.maxInstanceNumberPerServer)
                        || jobConfigA.time.hour != jobConfigB.time.hour
                        || jobConfigA.time.minute != jobConfigB.time.minute
                        || jobConfigA.time.second != jobConfigB.time.second
                        || jobConfigA.time.dayOfMonth != jobConfigB.time.dayOfMonth
                        || jobConfigA.time.dayOfWeek != jobConfigB.time.dayOfWeek
                        || jobConfigA.time.month != jobConfigB.time.month
                        || jobConfigA.time.timezone != jobConfigB.time.timezone
                        || jobConfigA.debugOutput != jobConfigB.debugOutput
                        || jobConfigA.forceRun != jobConfigB.forceRun
                        || jobConfigA.stopJob != jobConfigB.stopJob) {
                        return 1;
                    } else {
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

                        var environmentA = jobConfigA.environment || [];
                        var environmentB = jobConfigB.environment || [];
                        if (environmentA.length != environmentB.length) {
                            return 1;
                        }
                        for (var i = 0; i < environmentA.length; ++i) {
                            if (environmentA[i] != environmentB[i]) {
                                return 1;
                            }
                        }
                        return 0;
                    }
                };

                var _canStartOnThisServer = function () {
                    if (!_actualJobConfig) {
                        return false;
                    } else if (!_actualJobConfig.allowedHosts || _actualJobConfig.allowedHosts.length == 0) {
                        return true;
                    } else {
                        return _actualJobConfig.allowedHosts.indexOf(_hostId) != -1;
                    }
                }

                var _canStartOnThisEnvironment = function () {
                    if (!_actualJobConfig) {
                        return false;
                    } else if (!_actualJobConfig.environment || _actualJobConfig.environment.length == 0) {
                        return true;
                    } else {
                        return _actualJobConfig.environment.indexOf(Shared.config("environment.mode")) != -1;
                    }
                }

                var _startOrRestartTimer = function (initialStart) {
                    if (!_actualJobConfig) {
                        return Q.reject(new MiaError("Cron job db connection was not initialized"));
                    } else {
                        if (!_canStartOnThisServer()) {
                            if (initialStart === true) {
                                Logger.error("'" + self.identity + "' is not allowed to run on this host");
                            }
                            return Q();
                        } else {
                            if (!_canStartOnThisEnvironment()) {
                                if (initialStart === true) {
                                    Logger.error("'" + self.identity + "' is not allowed to run on this environment");
                                }
                                return Q();
                            }

                            if (!_cronJobTrigger) {
                                Q().then(function () {
                                    return self.initialize ? self.initialize(self) : Q();
                                }).then(function () {
                                    _cronJobTrigger = new CronJob(_getCronPattern(true),
                                        _workerWrapper,
                                        null,
                                        _isToBeStarted(),
                                        _getTimezone()
                                    );
                                    Logger.debug("'" + self.identity + "' is started with " + self.getConfigOutput());
                                    return Q();
                                }).then(function () {
                                    _forceRun(_cronJobTrigger);
                                    return Q();
                                });
                            } else {
                                var time = new CronTime(_getCronPattern(true), _getTimezone());
                                _cronJobTrigger.setTime(time); //stops job also
                                _setRunState(_isToBeStarted());
                                Logger.info("'" + self.identity + "' detected config update with " + self.getConfigOutput());
                                _forceRun(_cronJobTrigger);
                                return Q();
                            }
                        }
                    }
                };

                var _forceRun = function (cronJob) {
                    if (_actualJobConfig.forceRun) {
                        // Temporarily stop timer if going to force run
                        cronJob.stop();
                        Logger.info("'" + self.identity + "' timer temporarily stopped because of force run");
                        cronJob.running = true;

                        _workerWrapper()
                            .then(function () {
                                _continueTimer(cronJob);
                            })
                            .catch(function (error) {
                                Logger.error(error);
                                _continueTimer(cronJob);
                            });
                    }
                };

                var _continueTimer = function (cronJob) {
                    cronJob.running = false;
                    _setRunState(_isToBeStarted());
                    Logger.info("'" + self.identity + "' timer restarted");
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
                self.onServerDeletedHandler = function (err) {
                    if (_actualJobConfig.debugOutput === true && _informAboutMissingServerOnce && !_hasInformedAboutMissingServer) {
                        Logger.error("'" + self.identity + "' won't start, since the server is either paused or the server entry was removed from DB.");
                        _informAboutMissingServerOnce = false;
                        _hasInformedAboutMissingServer = true;
                    }
                    return Q.reject(new MiaError(err));
                };

                var _workerWrapper = function () {
                    //var stateOnStart = _.clone(_actualJobConfig);
                    var timeOnStart = new Date();

                    var serverUniqueId = self.getUniqueServerId();

                    return JobManagementDbConnector.validateDbServerEntry(serverUniqueId).catch(function (err) {
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
                                var now = new Date();
                                var timeLapsed = now - timeOnStart;
                                var timeout = 1000 - now.getMilliseconds();
                                var deferred = Q.defer();

                                // Wait till the next second to stop the job
                                setTimeout(() => {
                                    return JobManagementDbConnector.stopJob(jobId, timeLapsed)
                                        .then(function (result) {
                                            if (_actualJobConfig.debugOutput === true) {
                                                if (result > 0) {
                                                    return JobManagementDbConnector.getDbJobEntry(self.identity).then(function (jobInfo) {
                                                        _outputJobStats(jobInfo, serverUniqueId, false, timeLapsed);
                                                    });
                                                } else {
                                                    Logger.error("'" + self.identity + "' could not find/remove entry from db after finishing job instance.");
                                                }
                                            }
                                        })
                                        .then(function () {
                                            return deferred.resolve();
                                        });
                                }, timeout);

                                return deferred;
                            });
                        });
                    });
                };

                var _outputJobStats = function (jobDoc, serverUniqueId, started, timeLapsed) {
                    var stats = _getStats(jobDoc, serverUniqueId);
                    Logger.info("'" + self.identity + (started ? "' +1" : "' -1") + " active instances on this server: " + stats.runningThisServerCount + '/' + _actualJobConfig.maxInstanceNumberPerServer
                        + ', overall: ' + stats.runningOverallCount + '/' + _actualJobConfig.maxInstanceNumberTotal + (!started ? (', time lapsed: ' + timeLapsed + 'ms') : ''));
                };


                self.isRunning = function () {
                    return _cronJobTrigger && _cronJobTrigger.running;
                };


                self.stop = function () {
                    if (self.isRunning()) {
                        //stop job
                        _cronJobTrigger.stop();
                    }
                };

                var _start = function () {
                    if (!self.isRunning()) {
                        //stop job
                        _cronJobTrigger.start();
                    }
                };

                var _setRunState = function (runState) {
                    if (runState === true) {
                        _start();
                    } else {
                        self.stop();
                    }
                };

                self.shouldJobStop = async function () {
                    let stopJob;
                    if (!_.isUndefined(_actualJobConfig)) {
                        // Job was started by CronJobManager and is controlled by it
                        stopJob = _actualJobConfig.stopJob;
                    } else {
                        // Job was started on its own via cmd
                        const jobConfig = await _getParsedConfig();
                        stopJob = jobConfig.stopJob;
                    }
                    if (stopJob === true) {
                        Logger.info(`Stopping cron job "${self.identity}"`);
                        await JobManagementDbConnector.unsetStopFlag();
                        throw new MiaError(self.STOP_CRONJOB_CODE);
                    }
                }
            }
        });

    return BaseCronJob;
};

module.exports = thisModule();
