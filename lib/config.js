var _ = require('lodash')
var dotenv = require('dotenv')
var Joi = require('joi')

var SCHEMA = Joi.object().keys({
    appName: Joi.string(),
    corsOrigins: Joi.array().min(1).items(Joi.string()).required(),
    currency: Joi.string().required(),
    donateRedirectUri: Joi.string().required(),
    errorRedirectUri: Joi.string().required(),
    freeRedirectUri: Joi.string().required(),
    port: Joi.number().required(),
    sentryDsn: Joi.string(),
    stripePublishableKey: Joi.string().required(),
    stripeSecretKey: Joi.string().required(),
    successRedirectUri: Joi.string().required(),
    testEmail: Joi.string(),
    mailService: Joi.string(),
    mailUser: Joi.string(),
    mailPassword: Joi.string(),
    mailDestination: Joi.string(),
})

dotenv.load()

var config = {
    appName: process.env.APP_NAME,
    corsOrigins: parseString(process.env.CORS_ORIGINS) || ['*'],
    currency: process.env.CURRENCY || 'usd',
    donateRedirectUri: process.env.DONATE_REDIRECT_URI,
    errorRedirectUri: process.env.ERROR_REDIRECT_URI,
    freeRedirectUri: process.env.FREE_REDIRECT_URI,
    port: process.env.PORT || 3000,
    sentryDsn: process.env.SENTRY_DSN,
    stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    stripeSecretKey: process.env.STRIPE_SECRET_KEY,
    successRedirectUri: process.env.SUCCESS_REDIRECT_URI,
    testEmail: process.env.TEST_EMAIL,
    mailService: process.env.MAIL_SERVICE,
    mailUser: process.env.MAIL_USER,
    mailPassword: process.env.MAIL_PASSWORD,
    mailDestination: process.env.MAIL_DESTINATION,
}

Joi.assert(config, SCHEMA)

module.exports = config

function parseString(s) {
    return _.isString(s)
        ? s.split(',').map(function (_s) { return _s.trim() })
        : undefined
}
