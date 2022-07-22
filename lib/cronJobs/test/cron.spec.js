const Q = require('q')
    , Shared = require('./../../shared')
    , JobManagementDbConnector = require('../lib/jobManagementDbConnector.js')
    , CronJobExecutionModel = require('../lib/cronJobExecutionModel.js')
    , CronJobManagerJob = require('../lib/cronJobManagerJob.js')
    , ServerHeartbeatModel = require('../lib/cronServerHeartbeatModel.js')
    , CronJobConfigModel = require('../lib/cronJobConfigModel.js');

const validateCronJob =  (cronJOb, name) => {
    return CronJobConfigModel.validate(cronJOb.parsePresetConfig())
    .then(validatedConfig => {
        expect(validatedConfig).toBeDefined();
        expect(validatedConfig.identity).toBe(name);
        expect(validatedConfig.isSuspended).toBeFalsy();
        return validatedConfig;
    })
}

describe("cronJobs", function () {

    let serverId;
    let testJob1, testJob2, testJob3;
    let validatedJobConfig1, validatedJobConfig2, validatedJobConfig3;
    let jobId1, jobId3;

    beforeAll(function (next) {
        jasmine.database.connect()
            //.then(jasmine.database.drop)
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
                const testJobs = Shared.cronModules(['testJob1', 'testJob2', 'testJob3']);
                [testJob1, testJob2, testJob3] = testJobs;
            })
            .then(next);
    });
    afterAll(function (next) {
        jasmine.database.close()
            .then(next);
    });

    describe('shared.cronModules()', () => {
        it('throws error if wrong input passed', () => {
            expect(() => Shared.cronModules({})).toThrowError(Error, /invalid input/i);
        });

        it('returns all the possible crons if no input is passed', async () => {
            const x = Shared.cronModules();
            const [task1, task2, task3, task4, task5, genericCronJob, taskUndefined] =  Shared.cronModules();
            await validateCronJob(task1, 'testJob1');
            await validateCronJob(task2, 'testJob2');
            await validateCronJob(task3, 'testJob3');
            expect(genericCronJob.identity).toBe('generic-cronJobManagerJob'); // the last cronJOb be the generic one
            expect(taskUndefined).toBeUndefined();
        });

        it('returns all the requested crons if they exist', async () => {
            const tasks =  Shared.cronModules(['testJob3', 'testJobNotExisting', 'testJob2']);
            expect(tasks.length).toBe(2)
            const [task3, task2] = tasks;
            await validateCronJob(task2, 'testJob2');
            await validateCronJob(task3, 'testJob3');
        });

    });


    describe("Test basic functions", function () {

        
        afterAll(async () =>  {
            await CronJobManagerJob.stop();
            const tasks =  Shared.cronModules();
            await Promise.all(tasks.map(t => t.stop()));
            await Promise.all([CronJobExecutionModel.drop(), ServerHeartbeatModel.drop()]);
       });

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
            }).catch(function (err) {
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
    
        it('validate job configs #1', async () => {
            const testJobs =[[testJob1 ,'testJob1'], [testJob2 ,'testJob2'], [testJob3 ,'testJob3']];
            [validatedJobConfig1, validatedJobConfig2, validatedJobConfig3] = await Promise.all(
                testJobs.map(args => validateCronJob(args[0], args[1])));
        });

        it("getOrCreateDbJobEntry", async function (next) {
            try {
                expect(validatedJobConfig2).toBeDefined();
                const checkGetOrCreateDbJobEntry = async function (validatedConfig, testName) {
                    await JobManagementDbConnector.getOrCreateDbJobEntry(testName, validatedConfig).then(result => {
                        expect(result).toBeDefined();
                        expect(result._id).toBeDefined();
                        expect(result.typeName).toBe(testName);
                    });
                };

                const testJobs = [[validatedJobConfig1, 'testJob1'], [validatedJobConfig2, 'testJob2'], [validatedJobConfig3, 'testJob3']];
                await Promise.all(testJobs.map(args => checkGetOrCreateDbJobEntry(args[0], args[1])));
                next();
            } catch (e) {
                next.fail(e)
            }
        });

        it("startNewJob #1", function (next) {
            expect(serverId).toBeDefined();
            JobManagementDbConnector.startNewJob('testJob1', serverId, Shared.getCurrentHostId(), 2, 3).then(function (result) {
                expect(result).toBeDefined();
                jobId1 = result.jobId;
                next();
            }).catch(function (err) {
                next.fail(err);
            });
        });

        it("stopJob #1", function (next) {
            expect(jobId1).toBeDefined();
            JobManagementDbConnector.stopJob(jobId1, 101).then(function (result) {
                expect(result).toBe(1);
                next();
            }).catch(function (err) {
                next.fail(err);
            });
        });

        it("startNewJob #2 (not allowed on this host)", function (next) {
            expect(serverId).toBeDefined();
            JobManagementDbConnector.startNewJob('testJob2', serverId, Shared.getCurrentHostId(), 2, 3).then(function () {
                next();
            }).catch(function (err) {
                expect(err).toBeDefined();
                next();
            });
        });

        it("startNewJob #3", function (next) {
            expect(serverId).toBeDefined();
            JobManagementDbConnector.startNewJob('testJob3', serverId, Shared.getCurrentHostId(), 2, 3).then(result => {
                expect(result).toBeDefined();
                jobId3 = result.jobId;
                next();
            }).catch(function (err) {
                next.fail(err);
            });
        });

        it("stopJob #3", function (next) {
            expect(jobId3).toBeDefined();
            JobManagementDbConnector.stopJob(jobId3, 103).then(function (result) {
                expect(result).toBe(1);
                next();
            }).catch(function (err) {
                next.fail(err);
            });
        });

        it("cleanJobsOfDeadServers", function (next) {
            JobManagementDbConnector.cleanJobsOfDeadServers(10000).then(function () {
                next();
            }).catch(function (err) {
                next.fail(err);
            });
        });

    });

});
