## 2.9.0 (May 27, 2021)
* Upgraded ioredis package from 4.11.1 to 4.11.2
* Implemented environment config parameter to enable/disable MongoDB strict mode on collections (listCollections)

## 2.8.9 (February 17, 2021)
* Fixed HMR Windows compatibility

## 2.8.8 (February 12, 2021)
* Removed unnecessary log output in request module v2

## 2.8.7 (February 10, 2021)
* Ensure indexes on BaseModels synchronously instead of asynchronously

## 2.8.6 (January 27, 2021)
* Send header origin as CORS access-control-allow-origin when defined as * in routes config

## 2.8.5 (January 26, 2021)
* Removed EmbedModel in favour of enable/disable Models

## 2.8.4 (January 15, 2021)
* Fixed check for duplicate routes in RoutesHandler
* Made RoutesHandlers convertMethod() function available for the world

## 2.8.3 (January 08, 2021)
* Bugfix modelsvalidator when array with null value given

## 2.8.2 (December 28, 2020)
* Added EmbedModel without database integration for simple Model functionalities to use in conjunction with BaseModels
* Changed startup order so projects get initialized before routes

## 2.8.1 (August 19, 2020)
* ModelValidator: Bugfix un-/plain object structures for complex objects

## 2.8.0 (July 14, 2020)
* Preconditions: Added new validators "integer" and "safeInteger" 

## 2.7.9 (June 8, 2020)
* Added support for application/x-www-form-urlencoded in Swagger

## 2.7.8 (April 14, 2020)
* NPM audit

## 2.7.7 (April 14, 2020)
* Reset request.v2 to mia-js-core 2.7.2 version due to mem leak

## 2.7.6 (April 14, 2020)
* Added timeout event listener to request module again

## 2.7.5 (April 9, 2020)
* Fixed mem leak in request module

## 2.7.4 (April 8, 2020)
* Bugfix cronManagerJob not started without throwing error when non cron .js file in cron folder

## 2.7.3 (April 3, 2020)
* Request module v2: Fixed timeout errors not shown

## 2.7.2 (March 25, 2020)
* MiaError: Keep original errors stack trace if available

## 2.7.1 (March 18, 2020)
* MiaError: Stringify errors as message in case there are multiple

## 2.7.0 (March 11, 2020)
* Preconditions: Added new validator "allowMultiple"
* Return server object on MiaJs.start()
* Changed all errors to MiaError

## 2.6.1 (January 27, 2020)
* Allow 0 in schema for "allow" and "deny"

## 2.6.0 (November 28, 2019)
* Upgraded mongodb package from version 3.0.1 to 3.3.4
* Possibility to add index options to model attribute

## 2.5.7 (November 28, 2019)
* Increased default dead server interval

## 2.5.6 (November 27, 2019)
* Moved dead server interval setting (cron jobs) to environment configuration
* Added debug log to doHeartbeat func

## 2.5.5 (October 25, 2019)
* Fixed route methods deprecation warnings
* Fixed preconditions parsing for default and virtual
* Removed concatenation of '(deprecated)' to SwaggerUI project name

## 2.5.4 (October 18, 2019)
* Changed implementation of 'extend' in controller preconditions
* Some more improvements to Swagger-UI especially regarding readability

## 2.5.3 (October 15, 2019)
* Made minor improvements to Swagger-UI

## 2.5.2 (October 13, 2019)
* Hide swagger metrics when re-initializing routes (only with HMR)
* Added webpack progress bar to build process of development server
* Enhanced handling of 'hmr' argument, you know can hmr specific bundles

## 2.5.1 (October 8, 2019)
* Bugfix additional swagger options

## 2.5.0 (October 7, 2019)
* Modified display of http/s server options at startup
* Added new route option "parameterOverflow" to check if a route was given more than the configured parameters
* Updated Swagger-UI and parser to the latest versions
* Updated api specs to OpenAPI version 3.0.0
* Fixed all npm vulnerabilities
* Improvements to WebpackCompiler: Multiple bundles can now be compiled per project; responsibility to delete bundle files is now with the bundle configuration

## 2.4.20 (September 11, 2019)
* Added setting of custom server options for HTTP & HTTPS server

## 2.4.19 (September 6, 2019)
* Fixed bug with https redirection

## 2.4.18 (September 5, 2019)
* Added new http to https redirect options (redirFallbackHostname, redirHostname & redirPort)

## 2.4.17 (August 31, 2019)
* Fixed http redirect to https
* Use configured path from output path and output file name when purging prior bundles in WebpackCompiler

## 2.4.16 (July 10, 2019)
* Enhanced error handling redis

## 2.4.15 (July 9, 2019)
* Added replaceOne() to BaseModel

## 2.4.14 (July 4, 2019)
* Enhanced error logging for single cron job execution

## 2.4.13 (July 1, 2019)
* Enhanced default error logging

## 2.4.12 (June 26, 2019)
* Changed redis retry strategy

## 2.4.11 (June 21, 2019)
* Randomize generic-cronJobManagerJob run time

## 2.4.10 (May 14, 2019)
* Bugfix CORS header

## 2.4.9 (May 2, 2019)
* Implemented ability to hide route params from Swagger documentation

## 2.4.8 (April 16, 2019)
* Fixed security vulnerabilities

## 2.4.7 (April 9, 2019)
* Added missing function 'undotize' to MemberHelpers

## 2.4.6 (April 2, 2019)
* Consolidated development and build process of frontend projects and HMR devServer
* Fixed security vulnerability with js-yaml
* Fixed race condition in cron jobs test

## 2.4.5 (March 22, 2019)
* Bugfix initialize routes: Don't skip setup of default error handler if swagger is disabled

## 2.4.4 (March 18, 2019)
* Bugfix swagger mode option

## 2.4.3 (March 18, 2019)
* Allow route forwarding
* Allow different options to enable/disable swagger mode

## 2.4.2 (February 22, 2019)
* Added redir for swagger host if defined in env config

## 2.4.1 (February 22, 2019)
* Fixed log output if dead servers were killed

## 2.4.0 (February 20, 2019)
* Implemented environment config switch to de/activate Swagger docs
* Await initialization of individual projects during server start

## 2.3.4 (January 31, 2019)
* Fixed error handling in RoutesHandler
* Fixed env bug in WebpackCompiler

## 2.3.3 (January 23, 2019)
* Another enhancement regarding publicPath in WebpackCompiler Lib

## 2.3.2
* Enabled HTTPS in webpack HMR mode
* Fixed bson vulnerability

## 2.3.1
* Bugfix WebpackCompiler publicPath

## 2.3.0
* WebpackCompiler improvement regarding publicPath

## 2.2.9
* Replace TryCatch Module with try catch

## 2.2.8
* Added force option to cache handler

## 2.2.7
* Audit Fix

## 2.2.6
* Added functionality to stop running cron job

## 2.2.5
* Added JSON logging option to environment config
* Bugfix added cache control to swagger docs

## 2.2.4
* Fixed performance issue with indexOf() in swaggerDocs.js

## 2.2.3
* Update Swagger Docs

## 2.2.2
* Changed handling of cronjob execution if multiple cronjob identifiers given by cmd argument
* Set config option "forceRun" if cron jobs are executed immediately

## 2.2.1
* Added generic custom Error class which behaves like the plain error objects we're using

## 2.2.0
* Skip indexing Database on test env and by setting the env var skipDatabaseIndexing
* Disable all crons by passing arg 'nocron'
* Specify multiple crons to be started by passing their names separated by ','. cron=First,second,third
* CacheHandler will return given lifetime on first call
* Fixed bug with closing database connection in mongoAdapter
* Enhanced Shared to hold MongoClient instances as well as database connections
* Refactored q.fail() to .catch(); Removed q.done()

## 2.1.4 (September 21, 2018)
* Update cron package to latest version (1.4.1) which fixes timing issue with the same cronjob on multiple instances within the same second
* Improve baseCronJob to delay stopping of cronjobs till the next second

## 2.1.2 (May 28, 2018)
* Fixed configuration comparison in BaseCronJob if there are NaNs

## 2.1.1 (May 8, 2018)
* Minor enhancements and bugfixes regarding hot module replacement

## 2.1.0 (April 23, 2018)
* Enabled hot module replacement in vhost environments
* Minor enhancements

## 2.0.0 (April 18, 2018)
* Updated webpack to latest version and implemented hot module replacement

## 1.0.11 (April 11, 2018)
* Show cronjob not started message only on startup when environment restriction is set

## 1.0.10 (April 11, 2018)
* Added environment as config setting to cronjobs to restruct cronjob run to environment mode

## 1.0.9 (March 28, 2018)
* Bugfixed request timeout
* Bugfixed redis cache handler when cachetime is 0

## 1.0.8 (February 28, 2018)
* Added shard key check to baseModel

## 1.0.7 (February 6, 2018)
* Fixed a bug in all the cache handlers with function not defined in case caching was deactivated and Cached() is used only to get a value from cache
* Fixed baseModel.spec.js

## 1.0.6 (February 5, 2018)
* Added Promise helper to Mia-js Utils to convert Q promises to native and vice versa

## 1.0.5 (February 1, 2018)
* Allow getting a value from cache only without setting when using cache handler

## 1.0.4 (February 1, 2018)
* Added cacheTime to cache handler response. You can use this as cache control header
* Bugfixed memberHelbers mia-js-core Utils

## 1.0.3 (January 29, 2018)
* Set Swagger-Tools back to 0.8.1 due to a bug in Swagger Tools with optional Boolean parameters in routes

## 1.0.2 (January 25, 2018)
* Fixed a bug in the MongoAdapter that caused the wrong database name

## 1.0.1 (January 12, 2018)
* Reactivated all tests
* Fixed minor bugs

## 1.0 (January 10, 2018)
* Added Redis Cache support

## 0.9.10 (January 9, 2018)
* Upgraded mongodb package to version 3.0.1
* Fixed bug in _callGeneric() of baseModel
* Reactivated jasmine tests, see "npm test"
* Refactored express deprecations

## 0.9.9 (December 19, 2017)
* Moved webpack compiler dependencies in package.json

## 0.9.8 (November 28, 2017)
* Extended BaseModel to get all indexes which are defined in schema
* Fixed bug regarding use of multiple databases

## 0.9.7 (November 16, 2017)
* Enhanced Shared lib to serve cronjob core models too
* Added force run ability

## 0.9.5 (June 23, 2017)
* Updated compression package to version 1.6.2
* Set http/https app to Shared lib
* Added WebpackCompiler lib

## 0.9.4 (June 1, 2017)
* Updated mongodb package to version 2.2.27
* Bugfixes Model Validator

## 0.9.3 (May 17, 2017)
* Added ability to only start a single cronjob by cli argument
* Removed editor-fold from Shared library

## 0.9.2 (March 13, 2017)
* Added version support for config and models.

## 0.9.1 (January 31, 2017)
* Removed unused node_module time (not compatible with Node.js v6.9.4)
* Modified require paths of all libraries
* Added force run ability to cronjob management

## 0.9.0 (December 19, 2016)
* Upgraded memcached node_module to 2.2.2

## 0.8.9 (December 08, 2016)
* Added IP address Util

## 0.8.8 (November 11, 2016)
* Added follow redirects to request lib modul
* Bugfix: mia-js-core keepAliveAgent for https returned http agent
* Disable toobusy when maxLag is not set

## 0.8.7 (October 19, 2016)

* Bugfixed validation rules minLength and maxLength
* Bugfixed required validation when empty value
* Bugfixed error when cache not available
* Increased default max sockets for http connections to 1024

## 0.8.6 (August 5, 2016)

* Added keepAliveAgent to mia.js request module

## 0.8.2 (November 30, 2015)

* Moved modules of mia-js-core to lib folder

## 0.8.1 (Sepember 18, 2015)

* Updated modules mongodb, memcache and q to latest version due to memory leak
* Reengineered mia.ja to work with updated modules
* Reengineered mia.js logger

## 0.8.0 (August 28, 2015)

* Initial public release
