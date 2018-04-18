module.exports = babel => {
    const t = babel.types;
    let memberExpression = false;
    let callExpression = false;

    /**
     * Check first criteria: Was BaseCronJob imported?
     * @param {Object} node
     * @return {*}
     * @private
     */
    const _baseCronJobImported = node => {
        return t.isIdentifier(node.property, {name: 'BaseCronJob'});
    };

    /**
     * Check second criteria: Is Cronjob config existing?
     * @param {Object} node
     * @return {*}
     * @private
     */
    const _foundCronJobConfig = node => {
        const {callee, arguments} = node;

        return t.isMemberExpression(callee) && t.isIdentifier(callee.property, {name: 'extend'}) &&
            t.isObjectExpression(arguments[1]) && _hasProperties(arguments[1].properties);
    };

    /**
     * @param {Array} properties
     * @return {boolean}
     * @private
     */
    const _hasProperties = properties => {
        let hasTime = false;
        let hasIsSuspended = false;
        let hasAllowedHosts = false;
        let hasWorkerFunc = false;

        properties.forEach(prop => {
            if (t.isIdentifier(prop.key, {name: 'time'})) {
                hasTime = true;
            }
            if (t.isIdentifier(prop.key, {name: 'isSuspended'})) {
                hasIsSuspended = true;
            }
            if (t.isIdentifier(prop.key, {name: 'allowedHosts'})) {
                hasAllowedHosts = true;
            }
            if (t.isIdentifier(prop.key, {name: 'worker'}) && t.isFunctionExpression(prop.value)) {
                hasWorkerFunc = true;
            }
        });

        return hasTime && hasIsSuspended && hasAllowedHosts && hasWorkerFunc;
    };

    /**
     * Add HMR Listener
     * @param {Object} bodyPath
     * @private
     */
    const _addListener = bodyPath => {
        const body = bodyPath.get('body');

        if (memberExpression && callExpression) {

            body[body.length - 1].insertAfter(
                t.ifStatement(
                    t.memberExpression(
                        t.identifier('module'),
                        t.identifier('hot')
                    ),
                    t.blockStatement(
                        [
                            t.expressionStatement(
                                t.callExpression(
                                    t.memberExpression(
                                        t.memberExpression(
                                            t.identifier('module'),
                                            t.identifier('hot')
                                        ),
                                        t.identifier('dispose')
                                    ),
                                    [t.arrowFunctionExpression(
                                        [],
                                        t.blockStatement(
                                            [
                                                t.expressionStatement(t.callExpression(
                                                    t.memberExpression(
                                                        t.identifier('console'),
                                                        t.identifier('log')
                                                    ),
                                                    [
                                                        t.binaryExpression(
                                                            '+',
                                                            t.binaryExpression(
                                                                '+',
                                                                t.stringLiteral('[HMR] Going to change cron module file with identity "'),
                                                                t.memberExpression(
                                                                    t.memberExpression(
                                                                        t.identifier('module'),
                                                                        t.identifier('exports')
                                                                    ),
                                                                    t.identifier('identity')
                                                                )
                                                            ),
                                                            t.stringLiteral('"')
                                                        )
                                                    ]
                                                )),
                                                t.expressionStatement(t.callExpression(
                                                    t.memberExpression(
                                                        t.callExpression(
                                                            t.memberExpression(
                                                                t.identifier('Shared'),
                                                                t.identifier('cronModules')
                                                            ),
                                                            [
                                                                t.memberExpression(
                                                                    t.memberExpression(
                                                                        t.identifier('module'),
                                                                        t.identifier('exports')
                                                                    ),
                                                                    t.identifier('identity')
                                                                )
                                                            ]
                                                        ),
                                                        t.identifier('stop')
                                                    ),
                                                    []
                                                ))
                                            ]
                                        )
                                    )]
                                )
                            )
                        ]
                    )
                )
            );

            memberExpression = false;
            callExpression = false;
        }
    };

    return {
        visitor: {
            MemberExpression: path => {

                if (memberExpression && callExpression) {
                    // Add listener only once
                    return;
                }

                const {node} = path;

                if (!_baseCronJobImported(node)) {
                    return;
                }

                const bodyPath = path.findParent(path => t.isProgram(path.node));

                if (!t.isProgram(bodyPath)) {
                    return;
                }

                memberExpression = true;
                _addListener(bodyPath);
            },
            CallExpression: path => {

                if (memberExpression && callExpression) {
                    // Add listener only once
                    return;
                }

                const {node} = path;

                if (!_foundCronJobConfig(node)) {
                    return;
                }

                const bodyPath = path.findParent(path => t.isProgram(path.node));

                if (!t.isProgram(bodyPath)) {
                    return;
                }

                callExpression = true;
                _addListener(bodyPath);
            }
        }
    };
};
