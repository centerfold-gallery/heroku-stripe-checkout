var _ = require('lodash')
var config = require('./config')
var Nudge = require('hapi-nudge')
var nodemailer = require('nodemailer')
var Hapi = require('hapi')
var Joi = require('joi')
var stripe = require('stripe')(config.stripeSecretKey)

var PATHNAME = '/'
var PATHNAME_FREE_TIER = '/free'

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
server.app.PATHNAME = PATHNAME;

server.connection({
    port: config.port,
});

/*
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
*/

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
            card: request.payload.stripeToken,
            description: request.payload.description,
            metadata: _.extend({
                buyer_email: request.payload.stripeEmail,
                shipping_name: request.payload.stripeShippingName,
                shipping_address: request.payload.stripeShippingAddressLine1,
                shipping_address_zip: request.payload.stripeShippingAddressZip,
                shipping_address_state: request.payload.stripeShippingAddressState,
                shipping_address_city: request.payload.stripeShippingAddressCity,
                shipping_address_country: request.payload.stripeShippingAddressCountry,
                shipping_address_country_code: request.payload.stripeShippingAddressCountryCode,
                'cust_name': request.payload.customer_name
            }, request.payload.metadata),
        };        if (request.payload.description) {
            options.description = request.payload.description
        }

        stripe.charges.create(options, function (err) {
            sendEmail(err, logFields, options);

            if (err) {
                console.log(err);
                return reply.redirect(config.errorRedirectUri);
            }

            return reply.redirect(redirectUri);
        });
    },
    method: 'POST',
    path: PATHNAME,
});

function sendEmail(err, logFields, options) {

  let subject;
  if (err) {
    subject = 'Stripe failure';
  } else {
    subject = 'Thank you for your artwork purchase!';
  }

  let text = '<h1>' + subject + '</h1>\n';
  text += `Who: ${logFields.customer_name} \n`;
  text += `Email: ${logFields.email} \n`;
  text += `Description: ${options.description} \n`;
  text += `Amount: $ ${0.01 * parseInt(options.amount)} \n\n`;

  text += "Thank you!\nCenterfold\n";

  let html = '<h1>' + subject + '</h1>\n';
  html += `<b>Who:</b> ${logFields.customer_name} <br/>\n`;
  html += `<b>Email:</b> ${logFields.email} <br/>\n`;
  html += `<b>Description:</b> ${options.description} <br/>\n`;
  html += `<b>Amount:</b> $ ${0.01 * parseInt(options.amount)} <br/>\n`;

  html += "<p>Thank you for your artwork purchase! Your artwork is being prepared for shipping. You should receive an email from us in the next 24 hours to confirm your shipping address.<br/><br/>Love,<br/>CF</p>\n";

  if (err) html += '<h2>Error log:</h2>' + JSON.stringify(err);
  if (err) text += '\nError log:\n' + JSON.stringify(err);

  var mailOptions = {
    from: config.mailUser,
    to: logFields.email,
    subject: subject,
    text: text,
    html: html,
  };

  // if registration was successful, email the registrant as well
  if (!err) mailOptions.to += "," + logFields.email;

  mailer.sendMail(mailOptions, function(error, info){
    if (error) {
      console.log(error);
    } else {
      console.log('Email sent: ' + info.response);
    }
  });
};
