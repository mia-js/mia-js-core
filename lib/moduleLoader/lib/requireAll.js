/**
 * buildDictionary
 *
 * Go through each object, include the code, and determine its identity.
 * Tolerates non-existent files/directories by ignoring them (if 'optional' is specified)
 */

// imports
var fs = require('fs');
var ltrim = require('underscore.string').ltrim;
var rtrim = require('underscore.string').rtrim;
var _ = require('lodash');

// Returns false if the directory doesn't exist
function thisModule() {
    var self = this;

    /**
     * Loads iteratively all modules at given path, builds and returns a directory of modules as tree or as list
     *
     * Go through each object, include the code, and determine its identity.
     * Tolerates non-existent files/directories by ignoring them (if 'optional' is specified)
     *
     * @param {Object} options {
        dirname			:: the path to the source directory

        mode            :: options: {list, tree}
                           - list: generate a flat key-value map of modules
                           - tree: generate a full tree of modules

        injectIdentity	:: If disabled, (explicitly set to false) don't inject an identity into the module
                           default: true

        optional		:: if enabled, fail silently and return {} when source directory does not exist
                           or cannot be read (otherwise, exit w/ an error)
                           default: false

        depth			:: the level of recursion where modules will be included
                           default is to infinity

        useVersions  :: creates a sub grouping based on version property (only valid for list mode)
                           default: 'false'

        fileNameFilter	:: only include modules whose FILENAME matches this regex,
                           if 'undefined' - include all, default 'undefined'

        relativePathFilter	:: only include modules whose RELATIVE PATH (path with filename) matches this regex
                           (relative from the entry point directory), if 'undefined' - include all,
                           default 'undefined'

        excludeDirs	    :: regex to exclude directories

        dontLoad		:: if `dontLoad` is set to true, don't run the module w/ V8 or load it into memory--
                           instead, return a tree representing the directory structure
                           (all extant file leaves are included as keys, with their value = `true`)
     }
     * @returns dictionary of modules as list or as tree
     */
    self.requireAll = function (options) {

        //================
        // check options and extend default values
        options.replaceVal = options.replaceVal || '';

        if (!options.mode) {
            options.mode = 'list';
        }

        // exclude source control directories
        if (!options.excludeDirs) {
            options.excludeDirs = /^\.(git|svn)$/;
        }

        // default for 'fileNameFilter' option
        if (!options.fileNameFilter) {
            options.fileNameFilter = /(.*)/;
        }

        var iterationInfo = {
            currentDepth: 0,
            dirName: options.dirName,
            initialDirName: options.dirName
        };


        if (options.moduleDir) {
            return  checkModuleDir(options, iterationInfo);
        }
        else {
            return doInterations(options, iterationInfo);
        }
    };

    /**
     * Parses a directory and searches for options.module subdir. If found subdir is searched for required files
     * @param options
     * @param iterationInfo
     * @returns {{}}
     */
    var checkModuleDir = function (options, iterationInfo) {
        var files;
        var modules = {};
        var result = {};

        // remember the starting directory
        try {
            files = fs.readdirSync(iterationInfo.dirName);
        } catch (e) {
            if (options.optional)
                return {};
            else
                throw new Error('Directory not found: ' + iterationInfo.dirName);
        }

        // iterate through files in the current directory
        files.forEach(function (fileName) {
            iterationInfo.dirName = iterationInfo.initialDirName + '/' + fileName + '/' + options.moduleDir;
            iterationInfo.projectDir = iterationInfo.initialDirName + '/' + fileName;
            result = _.assign(doInterations(options, iterationInfo), result);
        });

        return result;
    };

    /**
     * Parses a directory (will be then iteratively called for all subdirectories) or loads a file.
     * @param options
     * @param iterationInfo
     * @returns {{}}
     */
    var doInterations = function (options, iterationInfo) {
        var files;
        var modules = {};

        // check if the counter has reached the desired depth indicated in options.depth
        if (typeof options.depth !== 'undefined' &&
            iterationInfo.currentDepth >= options.depth) {
            return;
        }

        // remember the starting directory
        try {
            files = fs.readdirSync(iterationInfo.dirName);
        } catch (e) {
            if (options.optional)
                return {};
            else
                throw new Error('Directory not found: ' + iterationInfo.dirName);
        }

        // iterate through files in the current directory
        files.forEach(function (fileName) {
            iterationInfo.fileName = fileName;
            //get absolute path
            iterationInfo.absolutePath = rtrim(iterationInfo.dirName, '/');
            iterationInfo.absoluteFullPath = iterationInfo.absolutePath + '/' + fileName;
            //get relative path
            iterationInfo.relativePath = iterationInfo.absolutePath.replace(iterationInfo.initialDirName, '');
            iterationInfo.relativeFullPath = iterationInfo.absoluteFullPath.replace(iterationInfo.initialDirName, '');
            // make sure a slash exists on the left side of relative paths
            iterationInfo.relativePath = '/' + ltrim(iterationInfo.relativePath, '/');
            iterationInfo.relativeFullPath = '/' + ltrim(iterationInfo.relativeFullPath, '/');

            if (fs.statSync(iterationInfo.absoluteFullPath).isDirectory()) {
                processDirectory(options, iterationInfo, modules)
            }
            else {
                processFile(options, iterationInfo, modules);
            }
        });

        return modules;
    };

    /**
     * Process single file to module dictionary
     * @param options
     * @param fileName
     * @param modules
     */
    var processFile = function (options, iterationInfo, modules) {
        // filename filter
        if (options.fileNameFilter) {
            var match = iterationInfo.fileName.match(options.fileNameFilter);
            if (!match) {
                return;
            }
        }

        // Filter spec.js files
        var match = iterationInfo.fileName.match(/.spec.js/i);
        if (match) {
            return;
        }

        // relative path filter
        if (options.relativePathFilter) {
            var pathMatch = iterationInfo.relativeFullPath.match(options.relativePathFilter);
            if (!pathMatch)
                return;
        }

        //load module
        loadModule(modules, options, iterationInfo);
    };

    /**
     * Load single module
     * @param modules
     * @param options
     * @param iterationInfo
     */
    var loadModule = function (modules, options, iterationInfo) {
        // load module into memory (unless `dontLoad` is true)

        var module = true;

        //default is options.dontLoad === false
        if (options.dontLoad !== true) {
            //if module is to be loaded
            module = require(iterationInfo.absoluteFullPath);

            // If a module is found but was loaded as 'undefined', don't include it (since it's probably unusable)
            if (typeof module === 'undefined') {
                throw new Error('Invalid module:' + iterationInfo.absoluteFullPath);
            }

            var identity;
            //var name;
            var version;

            if (options.useVersions === true) {
                if (module.version) {
                    version = module.version;
                }
                else {
                    version = '1.0';
                }
            }

            if (module.identity) {
                identity = module.identity;
                //name = identity;
            }
            else {
                identity = generateIdentity(options, iterationInfo);
                //name = identity;
            }

            //consider default options.injectIdentity === true
            if (options.injectIdentity !== false) {
                module.fileName = iterationInfo.fileName;
                module.projectDir = iterationInfo.projectDir;
                module.relativePath = iterationInfo.relativePath;
                module.relativeFullPath = iterationInfo.relativeFullPath;
                module.absolutePath = iterationInfo.absolutePath;
                module.absoluteFullPath = iterationInfo.absoluteFullPath;
                module.identity = identity;
                //module.name = name;
                if (options.useVersions === true) {
                    module.version = version;
                }
            }
            else {
                identity = generateIdentity(options, iterationInfo);
            }

            //check if identity is unique within the collection and add to dictionary
            if (options.useVersions === true) {
                if (modules[identity] && modules[identity][version]) {
                    var anotherModule = modules[identity][version];
                    throw new Error("Identity '" + identity + "' with version '" + version + "' is already registered by module at '" + anotherModule.absoluteFullPath + "'");
                }
                modules[identity] = modules[identity] || {};
                modules[identity][version] = module;
            }
            else {
                var anotherModule = modules[identity];
                if (anotherModule) {
                    throw new Error("Identity '" + identity + "' is already registered by module at '" + anotherModule.absoluteFullPath + "'");
                }
                modules[identity] = module;
            }
        }
    };

    /**
     * Generates identity for a module
     * @param options
     * @param iterationInfo
     * @returns {string}
     */
    var generateIdentity = function (options, iterationInfo) {
        // Use the identity for the key name
        var identity;
        if (options.mode === 'list') {
            identity = iterationInfo.relativeFullPath;
            //identity = identity.toLowerCase();
            //find and replace all containments of '/', ':' and '\' within the string
            identity = identity.replace(/\/|\\|:/g, '');
        }
        else if (options.mode === 'tree') {
            identity = iterationInfo.fileName;
            //identity = identity.toLowerCase();
        }
        else
            throw new Error('Unknown mode');

        //remove extention
        identity = identity.substr(0, identity.lastIndexOf('.')) || identity;

        return identity;
    };

    /**
     * Processes one directory level
     * @param options :: general options
     * @param iterationInfo :: iteration options
     * @param modules :: object in which output will be loaded
     */
    var processDirectory = function (options, iterationInfo, modules) {

        // Ignore explicitly excluded directories
        if (options.excludeDirs) {
            var match = iterationInfo.fileName.match(options.excludeDirs);
            if (match)
                return;
        }

        // Recursively call requireAll on each child directory
        var subIterationInfo = _.clone(iterationInfo);
        ++subIterationInfo.depth;
        subIterationInfo.dirName = iterationInfo.absoluteFullPath;

        //process subtree recursively
        var subTreeResult = doInterations(options, subIterationInfo);

        //omit empty dirs
        if (_.isEmpty(subTreeResult))
            return;

        //add to the list or to the subtree
        if (options.mode === 'list') {
            //check uniqueness
            _.forEach(subTreeResult, function (value, index) {
                if (options.useVersions === true) {
                    modules[index] = modules[index] || {};
                    _.forEach(value, function (versionValue, versionIndex) {
                        if (modules[index][versionIndex])
                            throw new Error("Identity '" + index + "' with version '" + versionIndex + "' is already registered by module at '" + modules[index][versionIndex].absoluteFullPath + "'");
                        modules[index][versionIndex] = versionValue;
                    });
                }
                else {
                    if (modules[index])
                        throw new Error("Identity '" + index + "' is already registered by module at '" + modules[index].absoluteFullPath + "'");
                    modules[index] = value;
                }
            })
        }
        else if (options.mode === 'tree') {
            if (options.markDirectories !== false) {
                subTreeResult.isDirectory = true;
            }

            var identity = generateIdentity(options, iterationInfo);
            modules[identity] = subTreeResult;
        }
        else
            throw new Error('Unknown mode');
    };

    return self;
};

module.exports = new thisModule();
