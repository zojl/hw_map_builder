require('dotenv').config()
const express = require('express');
const bodyParser = require('body-parser');
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
app.http = express();
app.bot = new VkBot({
  token: process.env.TOKEN,
  confirmation: process.env.CONFIRMATION
});
app.db = new Sequelize(process.env.DB, {logging: process.env.ENV.toLowerCase() === 'dev'});

app.db.Op = Sequelize.Op;
app.model = {};
app.model.devices = require('./app/model/devices.js')(app.db, Sequelize);
app.model.devices.sync();
app.model.connections = require('./app/model/connections.js')(app.db, Sequelize);
app.model.connections.sync();
app.model.subnets = require('./app/model/subnets.js')(app.db, Sequelize);
app.model.subnets.sync();
app.model.chats = require('./app/model/chats.js')(app.db, Sequelize);
app.model.chats.sync();
app.db.query("CREATE EXTENSION IF NOT EXISTS PostGIS;");
app.db.query("CREATE EXTENSION IF NOT EXISTS pgRouting;");

app.repository = {};
app.repository.connection = require('./app/repository/connection.js')(app.db, app.model);
app.repository.device = require('./app/repository/device.js')(app.db, app.model);
app.repository.subnet = require('./app/repository/subnet.js')(app.db, app.model);
app.repository.chat = require('./app/repository/chat.js')(app.db, app.model);

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
require('./app/messages/chat.js')(app);

require('./app/messages/plain.js')(app);

if (process.env.IS_STATBOT_ENABLED === 'true') {
  app.service.statBotImporter.initImport(60 * 1000);
}

app.bot.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    console.error(err);
  }
});

app.http.use(bodyParser.json());
app.http.post('/', app.bot.webhookCallback);
app.http.listen(process.env.PORT);

console.info('bot started');