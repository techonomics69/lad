const os = require('os');
const path = require('path');
const consolidate = require('consolidate');
const _ = require('lodash');
const Logger = require('@ladjs/logger');
const nodemailer = require('nodemailer');
const I18N = require('@ladjs/i18n');
const base64ToS3 = require('nodemailer-base64-to-s3');

const pkg = require('../package');
const env = require('./env');
const environments = require('./environments');
const utilities = require('./utilities');
const phrases = require('./phrases');
const meta = require('./meta');

const config = {
  emailFontPath: path.join(__dirname, '..', 'assets', 'fonts', 'GoudyBookletter1911.otf'),

  // package.json
  pkg,

  // server
  env: env.NODE_ENV,
  urls: {
    web: env.WEB_URL,
    api: env.API_URL
  },

  // app
  googleTranslateKey: env.GOOGLE_TRANSLATE_KEY,
  webRequestTimeoutMs: env.WEB_REQUEST_TIMEOUT_MS,
  apiRequestTimeoutMs: env.API_REQUEST_TIMEOUT_MS,
  contactRequestMaxLength: env.CONTACT_REQUEST_MAX_LENGTH,
  cookiesKey: env.COOKIES_KEY,
  email: {
    message: {
      from: env.EMAIL_DEFAULT_FROM
    },
    send: env.SEND_EMAIL,
    juiceResources: {
      preserveImportant: true
    }
  },
  logger: {
    showStack: env.SHOW_STACK,
    appName: env.APP_NAME
  },
  ga: env.GOOGLE_ANALYTICS,
  sessionKeys: env.SESSION_KEYS,
  isCactiEnabled: env.IS_CACTI_ENABLED,
  appName: env.APP_NAME,
  i18n: {
    // see @ladjs/i18n for a list of defaults
    // <https://github.com/ladjs/i18n>
    // but for complete configuration reference please see:
    // <https://github.com/mashpie/i18n-node#list-of-all-configuration-options>
    phrases,
    directory: path.join(__dirname, '..', 'locales')
  },

  // mongoose
  mongoose: {
    debug: env.MONGOOSE_DEBUG,
    Promise: global.Promise,
    mongo: {
      url: env.DATABASE_URL
    }
  },

  // agenda
  agenda: {
    name: `${os.hostname()}_${process.pid}`,
    maxConcurrency: env.AGENDA_MAX_CONCURRENCY
  },
  agendaCollectionName: env.AGENDA_COLLECTION_NAME,
  // these get automatically invoked to `agenda.every`
  // e.g. `agenda.every('5 minutes', 'locales')`
  // and you define them as [ interval, job name ]
  // you need to define them here for graceful handling
  agendaRecurringJobs: [],

  aws: {
    key: env.AWS_IAM_KEY,
    accessKeyId: env.AWS_IAM_KEY,
    secret: env.AWS_IAM_SECRET,
    secretAccessKey: env.AWS_IAM_SECRET,
    distributionId: env.AWS_CF_DI,
    domainName: env.AWS_CF_DOMAIN,
    params: {
      Bucket: env.AWS_S3_BUCKET
    }
  },

  // templating
  views: {
    // root is required by `koa-views`
    root: path.join(__dirname, '..', 'app', 'views'),
    // These are options passed to `koa-views`
    // <https://github.com/queckezz/koa-views>
    // They are also used by the email job rendering
    options: {
      extension: 'pug',
      map: {},
      engineSource: consolidate
    },
    // A complete reference of options for Pug (default):
    // <https://pugjs.org/api/reference.html>
    locals: {
      // Even though pug deprecates this, we've added `pretty`
      // in `koa-views` package, so this option STILL works
      // <https://github.com/queckezz/koa-views/pull/111>
      pretty: true,
      cache: env.NODE_ENV !== 'development',
      // debug: env.NODE_ENV === 'development',
      // compileDebug: env.NODE_ENV === 'development',
      ...utilities,
      filters: {}
    }
  },

  // stripe
  stripe: {
    secretKey: env.STRIPE_SECRET_KEY,
    publishableKey: env.STRIPE_PUBLISHABLE_KEY
  }
};

// merge environment configurations
if (_.isObject(environments[env.NODE_ENV])) _.merge(config, environments[env.NODE_ENV]);

// meta support for SEO
config.meta = meta(config);

// add i18n filter to views `:translate(locale)`
const logger = new Logger(config.logger);
const i18n = new I18N({
  ...config.i18n,
  logger
});
config.views.locals.filters.translate = function() {
  return i18n.api.t(...arguments);
};

// add global `config` object to be used by views
// TODO: whitelist keys here via `_.pick`
config.views.locals.config = config;

// add `views` to `config.email`
config.email.transport = nodemailer.createTransport({
  // you can use any transport here
  // but we use postmarkapp.com by default
  // <https://nodemailer.com/transports/>
  service: 'postmark',
  auth: {
    user: env.POSTMARK_API_TOKEN,
    pass: env.POSTMARK_API_TOKEN
  },
  logger
});
config.email.transport.use(
  'compile',
  base64ToS3({
    cloudFrontDomainName: env.AWS_CF_DOMAIN,
    aws: config.aws
  })
);

// config.email.transport.debug = true;
config.email.views = Object.assign({}, config.views);
config.email.views.root = path.join(__dirname, '..', 'emails');
config.email.i18n = config.i18n;
config.email.juiceResources.webResources = { relativeTo: config.buildDir };

module.exports = config;
