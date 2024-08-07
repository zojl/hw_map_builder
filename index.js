require('dotenv').config()
const fs = require('fs');
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
fs.readdir('./app/model/', function (err, files) {
  for (const scriptname of files) {
    const modelname = scriptname.split('.')[0];
    app.model[modelname] = require('./app/model/' + scriptname)(app.db, Sequelize);
    app.model[modelname].sync();
  };
  app.model.chats.sync({alter:true})
});
app.db.query("CREATE EXTENSION IF NOT EXISTS PostGIS;");
app.db.query("CREATE EXTENSION IF NOT EXISTS pgRouting;");
app.db.query(`CREATE OR REPLACE FUNCTION hex2dec(in_hex TEXT)
RETURNS INT
IMMUTABLE STRICT LANGUAGE sql AS $body$
  SELECT CAST(CAST(('x' || CAST($1 AS text)) AS bit(8)) AS INT);
$body$;`);

app.repository = {};
fs.readdir('./app/repository/', function (err, files) {
  for (const scriptname of files) {
    const repoName = scriptname.split('.')[0];
    app.repository[repoName] = require('./app/repository/' + scriptname)(app.db, app.model);
  };
});

app.dbUtil = {};
app.dbUtil.dbPusher = require('./app/dbUtil/dbPusher.js')(app.db, app.model);
app.dbUtil.pgroute = require('./app/dbUtil/pgroute.js')(app);
app.dbUtil.stats = require('./app/dbUtil/stats.js')(app.db, app.model);
app.dbUtil.unvisited = require('./app/dbUtil/unvisited.js')(app);
app.dbUtil.countedLinks = require('./app/dbUtil/countedLinks.js')(app);

app.service = {};
app.service.vHackApi = require('./app/service/vHackApi.js')(app);
app.service.statBotImporter = require('./app/service/statBotImporter.js')(app);
app.service.npcNotifier = require('./app/service/npcNotifier.js')(app);

app.getDates = function() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = (now - start) + ((start.getTimezoneOffset() - now.getTimezoneOffset()) * 60 * 1000);
  const oneDay = 1000 * 60 * 60 * 24;
  const year = now.getYear();
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
    "day": (year * 1000) + day,
    "dayOfMonth": dayOfMonth,
  }
}

app.getChatFromMessage = async function(ctx) {
  const chat = await app.repository.chat.getOneByPeerId(ctx.message.peer_id)
  if (chat === null) {
    console.log(`Chat ${ctx.message.peer_id} is not registered`);
    ctx.reply('Эта команда работает только в чатах, которым назначены подсети в боте.');
    return null;
  }

  return chat;
}

app.getSubnetFromChat = async function(chat) {
  if (typeof(chat.subnet) === 'undefined') {
    console.log(`Chat ${chat} is badly registered`);
    return null;
  }

  const subnet = await app.repository.subnet.getOneById(chat.subnet);
  if (subnet === null) {
    console.log(`Chat ${chat} is badly registered`);
    return null;
    //ctx.reply('Ошибка получения подсети, обратитесь в техподдержку.');
  }

  return subnet;
}

app.getSubnetFromMessage = async function(ctx) {
  const chat = await app.getChatFromMessage(ctx);

  return await app.getSubnetFromChat(chat);
}

require('./app/messages/start.js')(app);
require('./app/messages/route.js')(app);
require('./app/messages/stats.js')(app);
require('./app/messages/analyse.js')(app);
require('./app/messages/link.js')(app);
require('./app/messages/cycle.js')(app);
require('./app/messages/find.js')(app);
require('./app/messages/npc.js')(app);
require('./app/messages/subscribe.js')(app);

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
console.info('bot started as callback at ' + process.env.PORT);


if (process.env.INCOMING_DEVICES_PORT != '') {
  require('./app/service/deviceReceiver.js')(app);
}

//restart instruction for developer:
//docker compose build hwmap-builder && docker compose up hwmap-builder -d && docker compose logs hwmap-builder -f
