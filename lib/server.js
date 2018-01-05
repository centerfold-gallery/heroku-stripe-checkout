var _ = require('lodash')
var config = require('./config')
var Nudge = require('hapi-nudge')
var nodemailer = require('nodemailer')
var Hapi = require('hapi')
var Joi = require('joi')
var stripe = require('stripe')(config.stripeSecretKey)

var PATHNAME = '/'

var server = new Hapi.Server()

var mailer = nodemailer.createTransport({
  service: config.mailService,
  auth: {
    user: config.mailUser,
    pass: config.mailPassword,
  }
});

module.exports = server

// hi
// :
server.app.PATHNAME = PATHNAME

server.connection({
    port: config.port,
})

if (config.appName) {
    server.register({
        register: Nudge,
        options: {
            host: [
                config.appName,
                '.herokuapp.com',
            ].join(''),
            pathname: '/uptime',
            protocol: 'https',
        },
    }, function (err) { if (err) throw err })
}

server.route({
    config: {
        cors: {
            origin: config.corsOrigins,
        },
        validate: {
            payload: {
              amount: Joi.number().integer().greater(50).required(),
              customer_name: Joi.string().required(),
              metadata: Joi.string(),
              mailService: Joi.string(),
              terms: Joi.string(),
              description: Joi.string(),
              stripeToken: Joi.string().token().required(),
              stripeTokenType: Joi.string().regex(/^card$/),
              stripeEmail: Joi.string().email().required(),
              stripeBillingName: Joi.string(),
              stripeBillingAddressLine1: Joi.string(),
              stripeBillingAddressZip: Joi.string(),
              stripeBillingAddressState: Joi.string(),
              stripeBillingAddressCity: Joi.string(),
              stripeBillingAddressCountry: Joi.string(),
              stripeBillingAddressCountryCode: Joi.string(),
              stripeShippingName: Joi.string(),
              stripeShippingAddressLine1: Joi.string(),
              stripeShippingAddressZip: Joi.string(),
              stripeShippingAddressState: Joi.string(),
              stripeShippingAddressCity: Joi.string(),
              stripeShippingAddressCountry: Joi.string(),
              stripeShippingAddressCountryCode: Joi.string(),
            },
        },
    },
    handler: function (request, reply) {
        var logFields = {
          customer_name: request.payload.customer_name,
          email: request.payload.stripeEmail,
        };

        var options = {
          amount: request.payload.amount,
          currency: config.currency,
          source: request.payload.stripeToken,
          description: request.payload.description,
          metadata: {'cust_name': request.payload.customer_name},
        };

        if (request.payload.description) {
            options.description = request.payload.description
        }

        stripe.charges.create(options, function (err) {
            sendEmail(err, logFields, options);

            if (err) {
                console.log(err);
                return reply.redirect(config.errorRedirectUri);
            }
            return reply.redirect(config.successRedirectUri)
        });
    },
    method: 'POST',
    path: PATHNAME,
})

function sendEmail(err, logFields, options) {
  let subject = (err ? 'Stripe failure' : 'Stripe success');

  let text = JSON.stringify(logFields);
  text += JSON.stringify(options);

  let html = '<h1>' + subject + '</h1>';
  html += `<b>Who:</b> ${logFields.customer_name} <br/>`;
  html += `<b>Email:</b> ${logFields.email} <br/>`;
  html += `<b>Amount:</b> ${parseInt(options.amount)*0.01} <br/>`;
  html += `<b>Description:</b> ${options.description} <br/>`;

  if (err) html += '<h2>Error log:</h2>' + JSON.stringify(err);

  var mailOptions = {
    from: config.mailUser,
    to: config.mailDestination,
    subject: subject,
    text: text,
    html: html,
  };

  mailer.sendMail(mailOptions, function(error, info){
    if (error) {
      console.log(error);
    } else {
      console.log('Email sent: ' + info.response);
    }
  });
}
