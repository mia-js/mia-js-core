// Cron pattern:
//    minute         0-59
//    hour           0-23
//    day of month   0-31
//    month          0-12 (or names, see below)
//    day of week    0-7 (0 or 7 is Sun, or use names)
//
// A field  may  be an asterisk (*), which always stands for
// ``first-last''.
//
// Ranges of numbers are allowed.   Ranges  are  two  numbers
// separated  with  a  hyphen.  The specified range is inclu-
// sive.  For example, 8-11 for an ``hours'' entry  specifies
// execution at hours 8, 9, 10 and 11.
//
// Lists are allowed.  A list is a set of numbers (or ranges)
// separated by commas.  Examples: ``1,2,5,9'', ``0-4,8-12''.
//
// Step  values can be used in conjunction with ranges.  Fol-
// lowing a range with ``/<number>'' specifies skips  of  the
// number's value through the range.  For example, ``0-23/2''
// can be used in the hours field to specify  command  execu-
// tion  every other hour (the alternative in the V7 standard
// is ``0,2,4,6,8,10,12,14,16,18,20,22'').   Steps  are  also
// permitted after an asterisk, so if you want to say ``every
// two hours'', just use ``*/2''.
//
// Names can also be used for  the  ``month''  and  ``day  of
// week'' fields.  Use the first three letters of the partic-
// ular day or month (case doesn't matter).  Ranges or  lists
// of names are not allowed.
//
// Note: The day of a command's execution can be specified by
// two  fields  --  day  of  month, and day of week.  If both
// fields are restricted (ie, aren't *), the command will  be
// run when either field matches the current time.  For exam-
// ple,
// ``30 4 1,15 * 5'' would cause a command to be run at  4:30
// am on the 1st and 15th of each month, plus every Friday.

var _ = require('lodash');
var Q = require('q');
var Shared = require('./../../shared');
var BaseCronJob = require('./baseCronJob.js');
var JobManagementDbConnector = require('./jobManagementDbConnector.js');
var Logger = require('./../../logger').tag('Cron');

Q.stopUnhandledRejectionTracking();

var _deathInterval = 60 * 1000;

module.exports = BaseCronJob.extend({},
    {
        disabled: false, // Enable /disable job definition
        time: {
            hour: '0-23',
            minute: '0-59',
            second: '10,40',
            dayOfMonth: '0-31',
            dayOfWeek: '0-7', // (0 or 7 is Sun, or use names)
            month: '0-12',   // names are also allowed
            timezone: 'CET'
        },

        isSuspended: false,
        allowedHosts: [],

        maxInstanceNumberTotal: 0, //unlimited
        maxInstanceNumberPerServer: 1,

        identity: 'generic-cronJobManagerJob', // Job name

        staticConstructor: function () {
            var self = this;

            var _restartCount = 0;

            self.startListening = function () {
                var self = this;
                return JobManagementDbConnector.registerNewServer(Shared.getCurrentHostId(), _restartCount++).then(function (result) {
                    return Q(result._id);
                }).then(function (serverId) {
                    return self.initializeJob(serverId);
                });
            };

            self.initialize = function () {
                var promises = [];
                _.forEach(Shared.cronModules(), function (cronModule) {
                    if (cronModule.identity != self.identity) {
                        promises.push(cronModule.initializeJob(self.getUniqueServerId()));
                    }
                });

                return Q.allSettled(promises).then(function (results) {
                    return Q();
                });
            };

            self.onServerDeletedHandler = function (err) {
                //Logger('err', "Cron: '" + self.identity + "' has detected that the server entry was removed from DB and will create new server entry.");
                return Q();
            };

            var _cleanServers = function () {
                var initialServerUniqueId = self.getUniqueServerId();
                return JobManagementDbConnector.doHeartbeat(initialServerUniqueId).fail(function (err) {
                    Logger.error("Cron heartbeat for server id " + initialServerUniqueId + " failed", err);
                    return JobManagementDbConnector.registerNewServer(Shared.getCurrentHostId(), _restartCount);
                }).then(function (newServerInfo) {
                    var newServerUniqueId = newServerInfo._id;
                    if (newServerUniqueId && !newServerUniqueId.equals(initialServerUniqueId)) {
                        ++_restartCount;
                        Logger.info("This server was assigned a new unique id " + newServerUniqueId);

                        //update server ids
                        self.setUniqueServerId(newServerUniqueId);
                        _.forEach(Shared.cronModules(), function (cronModule) {
                            cronModule.setUniqueServerId(newServerUniqueId);
                        });
                    }
                    return Q();
                }).then(function () {
                    return JobManagementDbConnector.cleanJobsOfDeadServers(_deathInterval).then(function (result) {
                        if (result.length > 0) {
                            Logger.info("Killed jobs on " + result.length + " server(s) without heartbeat");
                        }
                        return Q();
                    });
                });
            };

            var _updateJobConfigs = function () {
                var promises = [];
                _.forEach(Shared.cronModules(), function (cronModule) {
                    promises.push(cronModule.updateJob());
                });
                //update itself
                promises.push(self.updateJob());
                return Q.allSettled(promises).then(function () {
                    return Q();
                });
            };

            self.worker = function () {
                return Q.allSettled([
                    _cleanServers(),
                    _updateJobConfigs()
                ]);
            };
        },

        created: '2015-08-07T19:00:00', // Creation date
        modified: '2015-08-07T19:00:00' // Last modified date
    });
