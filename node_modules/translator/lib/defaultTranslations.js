/**
 * Fallback translations which will be used if no other translation could be applied.
 * @type {{Gone: string, ExternalDataRequestError: string, InternalServerError: string, BadRequest: string, Forbidden: string, NotFound: string}}
 */
module.exports = {
    BadRequest: 'Something is not ok with your request',
    Unauthorized: 'You are not allowed to access this service',
    Forbidden: 'You are not allowed to access this service',
    NotFound: 'Whatever you are looking for it is not here',
    Gone: 'This resource is gone or never was there. Try another one.',
    ExternalDataRequestError: 'Unexpected data structure received from external API',
    InternalServerError: 'Oops - I\'m sorry but something went wrong'
};