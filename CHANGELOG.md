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