require('dotenv').config()
const VkBot = require('node-vk-bot-api');
const Sequelize = require('sequelize');
const Sentry = require("@sentry/browser");
const {BrowserTracing} = require("@sentry/tracing");

Sentry.init({
    dsn: process.env.SENTRY_DSN,
    integrations: [new BrowserTracing()],
    tracesSampleRate: 1.0,
});

let app = {};
app.sentry = Sentry;
app.bot = new VkBot(process.env.TOKEN);
app.db = new Sequelize(process.env.DB, {logging: process.env.ENV.toLowerCase() === 'dev'});

app.db.Op = Sequelize.Op;
app.model = {};
app.model.devices = require('./app/model/devices.js')(app.db, Sequelize);
app.model.devices.sync();
app.model.connections = require('./app/model/connections.js')(app.db, Sequelize);
app.model.connections.sync();
app.db.query("CREATE EXTENSION IF NOT EXISTS PostGIS;");
app.db.query("CREATE EXTENSION IF NOT EXISTS pgRouting;");

app.repository = {};
app.repository.connection = require('./app/repository/connection.js')(app.db, app.model);
app.repository.device = require('./app/repository/device.js')(app.db, app.model);

app.dbUtil = {};
app.dbUtil.pushToDB = require('./app/dbUtil/dbPusher.js')(app.db, app.model);
app.dbUtil.dijkstra = require('./app/dbUtil/dijkstra.js')(app.db, app.model);
app.dbUtil.stats = require('./app/dbUtil/stats.js')(app.db, app.model);
app.dbUtil.unvisited = require('./app/dbUtil/unvisited.js')(app);

app.service = {};
app.service.vHackApi = require('./app/service/vHackApi.js')(app);
app.service.statBotImporter = require('./app/service/statBotImporter.js')(app);

app.getDates = function() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = (now - start) + ((start.getTimezoneOffset() - now.getTimezoneOffset()) * 60 * 1000);
  const oneDay = 1000 * 60 * 60 * 24;
  let day = Math.floor(diff / oneDay);
  let dayOfMonth = now.getDate();
  if (now.getHours() < 18) {
    day--;

    if (dayOfMonth === 1) {
      dayOfMonth = -1;
    } else {
      dayOfMonth--;
    }
  }

  return {
    "day": day,
    "dayOfMonth": dayOfMonth,
  }
}

require('./app/messages/start.js')(app);
require('./app/messages/route.js')(app);
require('./app/messages/stats.js')(app);
require('./app/messages/analyse.js')(app);

require('./app/messages/plain.js')(app);

app.service.statBotImporter.initImport(60 * 1000);
console.info('bot started');

app.bot.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    console.error(err);
  }
});

function initPolling() {
    app.bot.startPolling((err) => {
        if (err) {
            app.sentry.captureException(err);
            console.error(err);
            app.bot.stop();
            initPolling();
        }
    });
}
initPolling();