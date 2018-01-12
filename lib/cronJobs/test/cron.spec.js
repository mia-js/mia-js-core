var Q = require('q')
    , Shared = require('./../../shared')
    , JobManagementDbConnector = require('../lib/jobManagementDbConnector.js')
    , CronJobManagerJob = require('../lib/cronJobManagerJob.js')
    , CronJobConfigModel = require('../lib/cronJobConfigModel.js');

describe("cronJobs", function () {

    var serverId;
    var testJob1, testJob2, testJob3;
    var validatedJobConfig1, validatedJobConfig2, validatedJobConfig3;
    var jobId1, jobId3;

    beforeAll(function (next) {
        jasmine.database.connect()
            .then(jasmine.database.drop)
            .then(function () {
                // Set different path for cron jobs
                Shared.config('system.path').projects = 'lib/cronJobs/test/data/projects';
                try {
                    Shared.initializeCronModules();
                } catch (err) {
                    return Q.reject(err);
                }
            })
            .then(function () {
                testJob1 = Shared.cronModules('testJob1');
                testJob2 = Shared.cronModules('testJob2');
                testJob3 = Shared.cronModules('testJob3');
            })
            .then(next);
    });
    afterAll(function (next) {
        jasmine.database.close()
            .then(next);
    });

    describe("Test basic functions", function () {

        it('initialize', function () {
            expect(testJob1).toBeDefined();
            expect(testJob2).toBeDefined();
            expect(testJob3).toBeDefined();
        });

        it("registerNewServer", function (next) {
            JobManagementDbConnector.registerNewServer(Shared.getCurrentHostId()).then(function (result) {
                expect(result._id).toBeDefined();
                serverId = result._id;
                next();
            }).fail(function (err) {
                next.fail(err);
            });
        });

        it("doHeartbeat", function (next) {
            JobManagementDbConnector.doHeartbeat(serverId).then(function (result) {
                next();
            }).fail(function (err) {
                next.fail(err);
            });
        });

        it('validate job config #1', function (next) {
            CronJobConfigModel.validate(testJob1.parsePresetConfig())
                .then(function (validatedConfig) {
                    expect(validatedConfig).toBeDefined();
                    expect(validatedConfig.identity).toBe('testJob1');
                    expect(validatedConfig.isSuspended).toBeFalsy();
                    validatedJobConfig1 = validatedConfig;
                    next();
                })
                .fail(function (err) {
                    next.fail(err);
                })
        });

        it('validate job config #2', function (next) {
            CronJobConfigModel.validate(testJob2.parsePresetConfig())
                .then(function (validatedConfig) {
                    expect(validatedConfig).toBeDefined();
                    expect(validatedConfig.identity).toBe('testJob2');
                    expect(validatedConfig.isSuspended).toBeFalsy();
                    validatedJobConfig2 = validatedConfig;
                    next();
                })
                .fail(function (err) {
                    next.fail(err);
                })
        });

        it('validate job config #3', function (next) {
            CronJobConfigModel.validate(testJob3.parsePresetConfig())
                .then(function (validatedConfig) {
                    expect(validatedConfig).toBeDefined();
                    expect(validatedConfig.identity).toBe('testJob3');
                    expect(validatedConfig.isSuspended).toBeFalsy();
                    validatedJobConfig3 = validatedConfig;
                    next();
                })
                .fail(function (err) {
                    next.fail(err);
                })
        });

        it("getOrCreateDbJobEntry", function (next) {
            expect(validatedJobConfig1).toBeDefined();
            JobManagementDbConnector.getOrCreateDbJobEntry('testJob1', validatedJobConfig1).then(function (result) {
                expect(result).toBeDefined();
                expect(result._id).toBeDefined();
                expect(result.typeName).toBe('testJob1');
                next();
            }).fail(function (err) {
                next.fail(err);
            });
        });

        it("getOrCreateDbJobEntry", function (next) {
            expect(validatedJobConfig2).toBeDefined();
            JobManagementDbConnector.getOrCreateDbJobEntry('testJob2', validatedJobConfig2).then(function (result) {
                expect(result).toBeDefined();
                expect(result._id).toBeDefined();
                expect(result.typeName).toBe('testJob2');
                next();
            }).fail(function (err) {
                next.fail(err);
            });
        });

        it("getOrCreateDbJobEntry", function (next) {
            expect(validatedJobConfig3).toBeDefined();
            JobManagementDbConnector.getOrCreateDbJobEntry('testJob3', validatedJobConfig3).then(function (result) {
                expect(result).toBeDefined();
                expect(result._id).toBeDefined();
                expect(result.typeName).toBe('testJob3');
                next();
            }).fail(function (err) {
                next.fail(err);
            });
        });

        it("startNewJob #1", function (next) {
            expect(serverId).toBeDefined();
            JobManagementDbConnector.startNewJob('testJob1', serverId, Shared.getCurrentHostId(), 2, 3).then(function (result) {
                expect(result).toBeDefined();
                jobId1 = result.jobId;
                next();
            }).fail(function (err) {
                next.fail(err);
            });
        });

        it("stopJob #1", function (next) {
            expect(jobId1).toBeDefined();
            JobManagementDbConnector.stopJob(jobId1, 101).then(function (result) {
                expect(result).toBe(1);
                next();
            }).fail(function (err) {
                next.fail(err);
            });
        });

        it("startNewJob #2 (not allowed on this host)", function (next) {
            expect(serverId).toBeDefined();
            JobManagementDbConnector.startNewJob('testJob2', serverId, Shared.getCurrentHostId(), 2, 3).then(function (result) {
                next();
            }).fail(function (err) {
                expect(err).toBeDefined();
                next();
            });
        });

        it("startNewJob #3", function (next) {
            expect(serverId).toBeDefined();
            JobManagementDbConnector.startNewJob('testJob3', serverId, Shared.getCurrentHostId(), 2, 3).then(function (result) {
                expect(result).toBeDefined();
                jobId3 = result.jobId;
                next();
            }).fail(function (err) {
                next.fail(err);
            });
        });

        it("stopJob #3", function (next) {
            expect(jobId3).toBeDefined();
            JobManagementDbConnector.stopJob(jobId3, 103).then(function (result) {
                expect(result).toBe(1);
                next();
            }).fail(function (err) {
                next.fail(err);
            });
        });

        it("cleanJobsOfDeadServers", function (next) {
            JobManagementDbConnector.cleanJobsOfDeadServers(10000).then(function (result) {
                next();
            }).fail(function (err) {
                next.fail(err);
            });
        });

        it("initialize baseCron", function (next) {
            CronJobManagerJob.initializeJob(serverId).then(function (result) {
                next();
            }).fail(function (err) {
                next.fail(err);
            });
        });
    });
});
