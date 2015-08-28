_ = require('underscore');

function thisModule () {
    var baseClass = function () {
    };

    // Helper function to correctly set up the prototype chain, for subclasses.
    // Similar to `goog.inherits`, but uses a hash of prototype properties and
    // class properties to be extended.
    baseClass.extend = function (protoProps, staticProps) {
        var parent = this;
        var child;

        // The constructor function for the new subclass is either defined by you
        // (the "constructor" property in your `extend` definition), or defaulted
        // by us to simply call the parent's constructor.
        if (protoProps && _.has(protoProps, 'constructor')) {
            //take provided constructor
            child = protoProps.constructor;
        } else {
            //set child's contructor function to call parent's constructor
            child = function () {
                return parent.apply(this, arguments);
            };
        }

        // Add static properties from parent and provided static properties, if supplied, to the child.
        _.extend(child, parent, staticProps);


        // Set the prototype chain to inherit from `parent`, without calling
        // `parent`'s constructor function.
        var Surrogate = function () {
            this.constructor = child;
        };
        Surrogate.prototype = parent.prototype;
        child.prototype = new Surrogate;

        // Add prototype properties (instance properties) to the subclass,
        // if supplied.
        if (protoProps) {
            _.extend(child.prototype, protoProps);
        }

        // Set a convenience property in case the parent's prototype is needed later.
        child.__super__ = parent.prototype;

        //set class
        child.prototype.schema = child;

        //static constructor initializes static properties of the child class
        if (parent['staticConstructor'] != null) {
            parent['staticConstructor'].apply(child);
        }
        if (child['staticConstructor'] != null) {
            child['staticConstructor'].apply(child);
        }

        return child;
    };

    return baseClass;
};

module.exports = thisModule();
