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

            let donation = options.description.includes('donation');
            let redirectUri =
              donation ? config.donateRedirectUri : config.successRedirectUri;

            return reply.redirect(redirectUri);
        });
    },
    method: 'POST',
    path: PATHNAME,
});

// FREE TIER ----------------------------------------------------
server.route({
    config: {
        cors: {
            origin: config.corsOrigins,
        },
        validate: {
            payload: {
              amount: Joi.number().integer().required(),
              customer_name: Joi.string().required(),
              description: Joi.string().required(),
              email: Joi.string().required(),
              terms: Joi.string().required(),
            },
        },
    },
    handler: function (request, reply) {
        var logFields = {
          customer_name: request.payload.customer_name,
          email: request.payload.email,
        };

        var options = {
          amount: 0,
          description: request.payload.description,
          metadata: {'cust_name': request.payload.customer_name},
        };

        if (request.payload.description) {
            options.description = request.payload.description
        }

        sendEmail(null, logFields, options);
/*
        if (err) {
            console.log(err);
            return reply.redirect(config.errorRedirectUri);
        }
*/
        if (options.amount == 0) {
          return reply.redirect(config.freeRedirectUri);
        }

        let donation = options.description.includes('donation');
        let redirectUri =
          donation ? config.donateRedirectUri : config.successRedirectUri;

        return reply.redirect(redirectUri);
    },
    method: 'POST',
    path: PATHNAME_FREE_TIER,
});

function sendEmail(err, logFields, options) {
  let donation = options.description.includes('donation');

  let subject;
  if (err) {
    subject = 'Stripe failure';
  } else if (donation) {
    subject = 'Zephyr donation successful!';
  } else {
    subject = 'Zephyr registration successful!';
  }

  let text = '<h1>' + subject + '</h1>\n';
  text += `Who: ${logFields.customer_name} \n`;
  text += `Email: ${logFields.email} \n`;
  text += `Description: ${options.description} \n`;
  text += `Amount: $ ${0.01 * parseInt(options.amount)} \n\n`;

  if (options.amount == 0) text += "Your membership is complimentary for 2018, but we would really appreciate your donation at any level, if you are so inclined. See https://zephyrtransport.org/donate for ways to donate.\n\n";

  if (!donation) text += "We'll be in touch with you soon to welcome you to Zephyr. If you have any questions, just email us at membership@zephyrtransport.org.\n\n";

  text += "Thank you!\nThe Zephyr Foundation\n";

  let html = '<h1>' + subject + '</h1>\n';
  html += `<b>Who:</b> ${logFields.customer_name} <br/>\n`;
  html += `<b>Email:</b> ${logFields.email} <br/>\n`;
  html += `<b>Description:</b> ${options.description} <br/>\n`;
  html += `<b>Amount:</b> $ ${0.01 * parseInt(options.amount)} <br/>\n`;

  if (options.amount == 0) html += '<br/>Your membership is complimentary for 2018, but we would really appreciate your donation at any level, if you are so inclined. See <a href="https://zephyrtransport.org/donate">zephyrtransport.org/donate</a> for ways to donate.\n\n';

  if (!donation) html += "<br><p>We'll be in touch with you soon to welcome you to Zephyr. If you have any questions, just email us at membership@zephyrtransport.org.</p>\n";

  html += "<p>Thank you!<br/>The Zephyr Foundation</p>\n";

  if (err) html += '<h2>Error log:</h2>' + JSON.stringify(err);
  if (err) text += '\nError log:\n' + JSON.stringify(err);

  var mailOptions = {
    from: config.mailUser,
    to: config.mailDestination,
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

