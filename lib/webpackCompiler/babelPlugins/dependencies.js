const _ = require('lodash');
const fs = require('fs');
let mappings;
let whitelistedSharedMembers;

module.exports = babel => {
    const t = babel.types;

    /**
     * Gets absolute file path for identity from mappings
     * @param {String} getter
     * @param {String} identity
     * @param {String} version
     * @returns {*}
     * @private
     */
    const _getAbsoluteFullPath = (getter, identity, version = '1.0') => {
        if (_.isUndefined(mappings[getter]) || _.isUndefined(mappings[getter][identity]) || _.isUndefined(mappings[getter][identity][version])) {
            return '';
        }
        return mappings[getter][identity][version];
    };

    return {
        visitor: {
            /**
             * Listen to CallExpression and replace Shared.x('identity') with a proper require() call
             * @param {Object} path
             * @param {Object} state
             * @constructor
             */
            CallExpression: (path, state) => {
                const {node} = path;
                const {callee} = node;

                if (_.isUndefined(callee.object) || _.isUndefined(callee.property)) {
                    return;
                }
                if (_.isUndefined(mappings)) {
                    // Load mappings

                    if (_.isUndefined(state.opts.mappingsFile)) {
                        return;
                    }
                    if (!fs.existsSync(state.opts.mappingsFile)) {
                        return;
                    }
                    mappings = require(state.opts.mappingsFile);

                    if (_.isUndefined(whitelistedSharedMembers)) {
                        // Load whitelist for Shared.x functions from mappings
                        whitelistedSharedMembers = Object.keys(mappings);
                    }
                }
                if (callee.object.name !== 'Shared' || whitelistedSharedMembers.indexOf(callee.property.name) === -1) {
                    return;
                }
                if (node.arguments.length <= 0 || _.isUndefined(node.arguments[0].value)) {
                    return;
                }

                const identity = node.arguments[0].value;
                const identityPath = identity.split('.');
                const absoluteFullPath = _getAbsoluteFullPath(callee.property.name, identityPath[0]);

                if (!absoluteFullPath) {
                    return;
                }

                identityPath.shift();

                let expression = t.callExpression(
                    t.identifier('require'),
                    [t.stringLiteral(absoluteFullPath)]
                );

                // For identifiers like 'SomeConfig.parent.child' we must wrap the CallExpression into MemberExpressions
                while (identityPath.length) {
                    const member = identityPath.shift();
                    expression = t.memberExpression(
                        expression,
                        t.identifier(member)
                    );
                }

                // Do the actual replace
                path.replaceWith(expression);
            }
        }
    };
};
