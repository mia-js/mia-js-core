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

const _ = require('lodash');
const Q = require('q');
const Shared = require('./../../shared');
const BaseCronJob = require('./baseCronJob.js');
const JobManagementDbConnector = require('./jobManagementDbConnector.js');
const Logger = require('./../../logger').tag('Cron');
const CronJobExecutionModel = require('./cronJobExecutionModel.js');

Q.stopUnhandledRejectionTracking();

module.exports = BaseCronJob.extend({},
    {
        disabled: false, // Enable /disable job definition
        time: {
            hour: '0-23',
            minute: '0-59',
            second: 'RANDOM,RANDOM',
            dayOfMonth: '0-31',
            dayOfWeek: '0-7', // (0 or 7 is Sun, or use names)
            month: '0-12',   // names are also allowed
            timezone: 'CET'
        },

        isSuspended: false,
        allowedHosts: [],
        environment: [],

        maxInstanceNumberTotal: 0, //unlimited
        maxInstanceNumberPerServer: 1,

        identity: 'generic-cronJobManagerJob', // Job name

        staticConstructor:  function ()  {
            const self = this;

            let _restartCount = 0;

            self.startListening = (cronTasks) => {
                var self = this;
                self.cronTasks = cronTasks;
                return JobManagementDbConnector.registerNewServer(Shared.getCurrentHostId(), _restartCount++)
                    .then(result => Q(result._id)).then(serverId => self.initializeJob(serverId));
            };

            self.initialize = () => {
                const promises = [];
                Shared.cronModules(self.cronTasks).forEach(cronModule => {
                    if (cronModule.identity !== self.identity) {
                      try {
                        const jobState = cronModule.initializeJob(self.getUniqueServerId());
                        promises.push(jobState)
                      } catch (err) {
                        Logger.error(cronModule.identity + ' not started. Not a valid cron job')
                      }
                    }
                });

                return Q.allSettled(promises).then( () => Q());
            };

            self.onServerDeletedHandler =  err => {
                //Logger('err', "Cron: '" + self.identity + "' has detected that the server entry was removed from DB and will create new server entry.");
                return Q();
            };

            const _cleanServers =  () => {
                const initialServerUniqueId = self.getUniqueServerId();
                return JobManagementDbConnector.doHeartbeat(initialServerUniqueId).catch(err => {
                    Logger.error("Cron heartbeat for server id " + initialServerUniqueId + " failed", err);
                    return JobManagementDbConnector.registerNewServer(Shared.getCurrentHostId(), _restartCount);
                }).then(newServerInfo => {
                    const newServerUniqueId = newServerInfo._id;
                    if (newServerUniqueId && !newServerUniqueId.equals(initialServerUniqueId)) {
                        ++_restartCount;
                        Logger.info("This server was assigned a new unique id " + newServerUniqueId);

                        //update server ids
                        self.setUniqueServerId(newServerUniqueId);
                        Shared.cronModules(self.cronTasks).forEach(cronModule => {
                            if (cronModule.identity !== self.identity) {
                                cronModule.setUniqueServerId(newServerUniqueId);
                            }
                        });
                    }
                    return Q();
                }).then(() => {
                    const env = Shared.config("environment");
                    const deadServerInterval = _.get(env, 'cronJobs.deadServerInterval', 120 * 1000);
                    return JobManagementDbConnector.cleanJobsOfDeadServers(deadServerInterval).then(deadServersCount => {
                        if (deadServersCount > 0) {
                            Logger.info("Killed all jobs on " + deadServersCount + " server(s) without heartbeat");
                        }
                        return Q();
                    });
                }).then(() => {
	                // Clean up crons that do not exist anymore
                    const allCurrentCronsIdentities = Shared.cronModules(self.cronTasks).map((cronModule) => cronModule.identity)
                    return CronJobExecutionModel.deleteMany({ typeName: { $nin: allCurrentCronsIdentities } })
                });
            };

            const _updateJobConfigs = () => {
                var promises = [];
                Shared.cronModules(self.cronTasks).forEach(cronModule => {
                    if (cronModule.identity != self.identity) {
                        promises.push(cronModule.updateJob());
                    }
                });
                //update itself
                promises.push(self.updateJob());
                return Q.allSettled(promises).then(() => Q());
            };

            self.worker = () => {
                return Q.allSettled([
                    _cleanServers(),
                    _updateJobConfigs()
                ]);
            };
        },

        created: '2015-08-07T19:00:00', // Creation date
        modified: '2019-06-21T15:00:00' // Last modified date
    });
