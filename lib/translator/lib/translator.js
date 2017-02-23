var Shared = require('./../../shared')
    , _ = require('lodash')
    , DefaultTranslations = require('./defaultTranslations.js');

function thisModule() {
    var self = this;

    var _checkTranslationKeyMatch = function (key, dictionary, language, region) {

        var translation;
        // Check for language key
        if (dictionary && dictionary[key] && dictionary[key][language] && _.isString(dictionary[key][language])) {
            translation = dictionary[key][language];
        }
        // Check for language key with region characteristic
        else if (dictionary && dictionary[key] && dictionary[key][language] && dictionary[key][language][region]) {
            translation = dictionary[key][language][region];
        }
        return translation;
    };


    /**
     * Get translation for a key from a dictionary
     * @param key - Identifier
     * @param replacements - Replaces all [0],[1]... in a translation get in order of the given replacements Array i.e. ['bunny','bird']
     * @returns {string}
     */
    self.getTranslation = function (group, key, language, region, replacements) {
        var defaultLanguage = Shared.config('system.defaultCulture.language')
            , defaultRegion = Shared.config('system.defaultCulture.region')
            , dictionary
            , translation;

        if (!group || group == 'system') {
            dictionary = Shared.config('translations');
        }
        else {
            dictionary = Shared.config(group + '.translations')
        }

        //check if we could load translations
        if (!dictionary) {
            return 'group ' + group + ' is not found';
        }

        // Make replacements an array if is not
        if (replacements && !_.isArray(replacements)) {
            replacements = [replacements];
        }

        //Check current language and region
        translation = _checkTranslationKeyMatch(key, dictionary, language, region);

        //Fallback to language defaultCulture language with given user region
        if (!translation) {
            translation = _checkTranslationKeyMatch(key, dictionary, defaultLanguage, region);
        }

        //Fallback to language defaultCulture language with defaultCulture region
        if (!translation) {
            translation = _checkTranslationKeyMatch(key, dictionary, defaultLanguage, defaultRegion);
        }

        //Fallback to default translation
        if (!translation && DefaultTranslations[key]) {
            translation = DefaultTranslations[key]
        }

        //Missing translation
        if (!translation) {
            translation = 'Missing translation for key ' + key;
        }

        // Return translation and replace all %s with replacements
        /*return translation.replace(/(%s|%d)/g, function (match) {
         var thisReplace = match;
         if (replacements && replacements[replacementCounter]) {
         thisReplace = replacements[replacementCounter];
         }
         ++replacementCounter;
         return thisReplace;
         });*/
        return translation.replace(/\[(\d)\]/g, function (match) {
            var thisKey = parseInt(match.replace(/(\[|\])/, ''));
            if (replacements && replacements[thisKey]) {
                match = replacements[thisKey];
            }
            return match;
        });
    };

    self.getTranslation.default = function (group, key, replacements) {
        return self.getTranslation(group, key, 'en', 'en', replacements);
    };

    return self.getTranslation;
};

module.exports = new thisModule();
