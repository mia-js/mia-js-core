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