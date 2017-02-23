global.sharedInfo = null;
var Shared = require('./../../shared')
    , Q = require('q')
    , MongoAdapter = require('./../../dbAdapters').MongoAdapter
    , JobManagementDbConnector = require('../lib/jobManagementDbConnector.js')
    , CronJobManagerJob = require('../lib/cronJobManagerJob.js');

Q.stopUnhandledRejectionTracking();

describe("Initialize", function () {
    //it("do inits", function (next) {
    //    //initialize config
    //    Shared.initializeConfig('/config', process.argv[2]);
    //    //create new mongo db Adapter
    //    var mongoDbAdapter = new MongoAdapter();
    //    //register adapter
    //    Shared.registerDbAdapter('mongo', mongoDbAdapter);
    //
    //    //set different path for cron jobs
    //    Shared.config('system.path').projects = '/node_modules/./../../cronJobs/test/data/projects';
    //    Shared.initializeCronModules();
    //    next();
    //});
    //
    //var serverId, jobId;
    //describe("Test basic functions", function () {
    //    it("registerNewServer", function (next) {
    //        JobManagementDbConnector.registerNewServer(Shared.getCurrentHostId()).then(function (result) {
    //            serverId = result._id;
    //            next();
    //        }).fail(function (err) {
    //            console.log(err);
    //            expect(true == false).toBeTruthy();
    //        });
    //    });
    //
    //    it("doHeartbeat", function (next) {
    //        JobManagementDbConnector.doHeartbeat(serverId).then(function (result) {
    //            next();
    //        }).fail(function (err) {
    //            console.log(err);
    //            expect(true == false).toBeTruthy();
    //        });
    //    });

        //it("getOrCreateDbJobEntry", function (next) {
        //    JobManagementDbConnector.getOrCreateDbJobEntry('testJob1').then(function (result) {
        //        next();
        //    }).fail(function (err) {
        //        console.log(err);
        //        expect(true == false).toBeTruthy();
        //    });
        //});
        //
        //it("getOrCreateDbJobEntry", function (next) {
        //    JobManagementDbConnector.getOrCreateDbJobEntry('testJob2').then(function (result) {
        //        next();
        //    }).fail(function (err) {
        //        console.log(err);
        //        expect(true == false).toBeTruthy();
        //    });
        //});
        //
        //it("getOrCreateDbJobEntry", function (next) {
        //    JobManagementDbConnector.getOrCreateDbJobEntry('testJob3').then(function (result) {
        //        next();
        //    }).fail(function (err) {
        //        console.log(err);
        //        expect(true == false).toBeTruthy();
        //    });
        //});
        //
        //it("startNewJob #1", function (next) {
        //    JobManagementDbConnector.startNewJob('testJob1', serverId, Shared.getCurrentHostId(), 2, 3).then(function (result) {
        //        jobId = result;
        //        next();
        //    }).fail(function (err) {
        //        console.log(err);
        //        expect(true == false).toBeTruthy();
        //    });
        //});
        //
        //it("stopJob #1", function (next) {
        //    expect(jobId).toBeDefined();
        //    JobManagementDbConnector.stopJob(jobId).then(function (result) {
        //        next();
        //    }).fail(function (err) {
        //        console.log(err);
        //        expect(true == false).toBeTruthy();
        //    });
        //});
        //
        //it("startNewJob #2", function (next) {
        //    JobManagementDbConnector.startNewJob('testJob2', serverId, Shared.getCurrentHostId(), 2, 3).then(function (result) {
        //        jobId = jobId;
        //        next();
        //    }).fail(function (err) {
        //        console.log(err);
        //        expect(true == false).toBeTruthy();
        //    });
        //});
        //
        //it("startNewJob #3", function (next) {
        //    JobManagementDbConnector.startNewJob('testJob3', serverId, Shared.getCurrentHostId(), 2, 3).then(function (result) {
        //        jobId = jobId;
        //        next();
        //    }).fail(function (err) {
        //        console.log(err);
        //        expect(true == false).toBeTruthy();
        //    });
        //});
        //
        //it("cleanJobsOfDeadServers", function (next) {
        //    JobManagementDbConnector.cleanJobsOfDeadServers(10000).then(function (result) {
        //        next();
        //    }).fail(function (err) {
        //        console.log(err);
        //        expect(true == false).toBeTruthy();
        //    });
        //});

        //it("initialize baseCron", function (next) {
        //    //var cron = Shared.cronModules('generic-cronJobManagerJob');
        //    CronJobManagerJob.initializeJob(serverId).then(function (result) {
        //        setTimeout(function() {
        //            next();
        //        }, 4000);
        //    }).fail(function (err) {
        //        console.log(err);
        //        expect(true == false).toBeTruthy();
        //    });
        //});
    //});
});
