const Logger = require('./../../logger').tag('mia-js-core', 'parameterOverflow')

/**
 * Checks requests whether there are more parameters send than configured
 *
 * Applicable for every route use the following syntax and values:
 * - parameterOverflow: 'log' (overflow is going to be logged only)
 * - parameterOverflow: 'block' (request is going to be blocked and logged)
 */
module.exports = (req, res, next) => {
    const _getParamsDifference = (validParams, givenParams) => {
        validParams = Object.keys(validParams)
        givenParams = Object.keys(givenParams)

        return givenParams.filter(p => !validParams.includes(p));
    }
    const {query, body} = req
    const routeConfig = req.miajs.route

    if (['block', 'log'].indexOf(routeConfig.parameterOverflow) !== -1) {
        let parametersOfAllControllers = {}
            for (const controller of req.miajs.commonValidatedParameters) {
                parametersOfAllControllers = Object.assign({}, parametersOfAllControllers, controller.data)
            }
            const queryDifference = _getParamsDifference(parametersOfAllControllers.query || {}, query)
            const bodyDifference = _getParamsDifference(parametersOfAllControllers.body || {}, body)

            if (queryDifference.length || bodyDifference.length) {
                let message = `[${req.method}] ${routeConfig.url} was given more parameters than configured:`
                if (queryDifference.length) {
                    message += ` [QUERY: ${queryDifference.join(', ')}]`
                }
                if (bodyDifference.length) {
                    message += ` [BODY: ${bodyDifference.join(', ')}]`
                }

                if (routeConfig.parameterOverflow === 'log') {
                    Logger.warn(message)
                } else if (routeConfig.parameterOverflow === 'block') {
                    Logger.warn(`${message}; the request was blocked`)
                    let errors = [];
                    if (queryDifference.length) {
                        errors.push({
                            code: 'AdditionalParamsNotAllowed',
                            msg: `More parameters in query given than allowed: ${queryDifference.join(', ')}`,
                            in: 'query'
                        })
                    }
                    if (bodyDifference.length) {
                        errors.push({
                            code: 'AdditionalParamsNotAllowed',
                            msg: `More parameters in body given than allowed: ${bodyDifference.join(', ')}`,
                            in: 'body'
                        })
                    }
                    next({status: 400, err: errors})
                    return
                }
            }
    }
    next()
}
