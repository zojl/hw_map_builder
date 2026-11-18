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

// Since Node 15 an unhandled rejection kills the process. Command handlers aren't awaited
// by node-vk-bot-api/express, so any handler error would crash the bot: log it instead.
process.on('unhandledRejection', (reason) => {
    console.error('Unhandled rejection:', reason);
    Sentry.captureException(reason);
});

let app = {};
app.sentry = Sentry;
app.http = express();
// How VK delivers updates: 'callback' (VK POSTs them to our HTTP port) or 'longpoll'
// (we poll VK ourselves, no public address needed). Default keeps the old behaviour.
const BOT_MODE = (process.env.BOT_MODE || 'callback').toLowerCase();
if (!['callback', 'longpoll'].includes(BOT_MODE)) {
  throw new Error(`Unknown BOT_MODE "${process.env.BOT_MODE}", expected callback or longpoll`);
}

app.bot = new VkBot({
  token: process.env.TOKEN,
  confirmation: process.env.CONFIRMATION,
  // Only needed for longpoll; without it the library asks VK for the token's group.
  group_id: process.env.GROUP_ID || undefined,
});
app.db = new Sequelize(process.env.DB, {logging: process.env.ENV.toLowerCase() === 'dev'});

app.db.Op = Sequelize.Op;
app.model = {};
for (const scriptname of fs.readdirSync('./app/model/')) {
  const modelname = scriptname.split('.')[0];
  app.model[modelname] = require('./app/model/' + scriptname)(app.db, Sequelize);
}
app.db.query("CREATE EXTENSION IF NOT EXISTS PostGIS;");
app.db.query("CREATE EXTENSION IF NOT EXISTS pgRouting;");
app.db.query(`CREATE OR REPLACE FUNCTION hex2dec(in_hex TEXT)
RETURNS INT
IMMUTABLE STRICT LANGUAGE sql AS $body$
  SELECT CAST(CAST(('x' || CAST($1 AS text)) AS bit(8)) AS INT);
$body$;`);

// Schema changes that sync() can't make: it creates missing tables but never alters existing ones.
// Each is a no-op once applied or on a fresh database. They run one by one and before sync():
// sync() reads the table's indexes from the catalog, and DDL running at the same time fails that
// read with "cache lookup failed".
const schemaChanges = [
  // chats used to be synced a second time with {alter: true}, which added one more unique
  // constraint on peerId on every start. Drop those duplicates.
  `DO $$
  DECLARE c text;
  BEGIN
    FOR c IN SELECT conname FROM pg_constraint
             WHERE conrelid = to_regclass('chats') AND contype = 'u' AND conname ~ '^chats_peerId_key[0-9]+$' LOOP
      EXECUTE format('ALTER TABLE chats DROP CONSTRAINT %I', c);
    END LOOP;
  END $$;`,
  // VK user IDs no longer fit into INTEGER
  `DO $$
  DECLARE t text;
  BEGIN
    FOREACH t IN ARRAY ARRAY['npcLocations', 'serviceLocations'] LOOP
      IF EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = t AND column_name = 'vkUser' AND data_type = 'integer') THEN
        EXECUTE format('ALTER TABLE %I ALTER COLUMN "vkUser" TYPE BIGINT', t);
      END IF;
    END LOOP;
  END $$;`,
  // Permission flags of /history and /map, apart from canSeeNpc
  `DO $$
  BEGIN
    IF to_regclass('chats') IS NOT NULL THEN
      ALTER TABLE chats ADD COLUMN IF NOT EXISTS "canSeeHistory" BOOLEAN;
      ALTER TABLE chats ADD COLUMN IF NOT EXISTS "canSeeMap" BOOLEAN;
    END IF;
  END $$;`,
];
(async () => {
  for (const sql of schemaChanges) {
    await app.db.query(sql);
  }
  for (const model of Object.values(app.model)) {
    await model.sync();
  }
})().catch((err) => {
  console.error('Database schema update failed:', err);
  Sentry.captureException(err);
});

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
app.service.notifier = require('./app/service/notifier.js')(app);
app.service.mapLink = require('./app/service/mapLink.js');

app.getDates = require('./app/util/dates.js');

app.getChatFromMessage = async function(ctx) {
  const chat = await app.repository.chat.getOneByPeerId(ctx.message.peer_id)
  if (chat === null) {
    console.log(`Chat ${ctx.message.peer_id} is not registered`);
    ctx.reply('Эта команда работает только в чатах, которым назначены подсети в боте. Чтобы подключить чат, отправь /chat и передай ID чата администратору бота.');
    return null;
  }

  return chat;
}

app.getSubnetFromChat = async function(chat) {
  if (chat === null) {
    return null;
  }

  if (typeof(chat.subnet) === 'undefined') {
    console.log(`Chat ${chat.peerId} is badly registered`);
    return null;
  }

  const subnet = await app.repository.subnet.getOneById(chat.subnet);
  if (subnet === null) {
    console.log(`Chat ${chat.peerId} is badly registered`);
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
require('./app/messages/history.js')(app);
require('./app/messages/service.js')(app);
require('./app/messages/subscribe.js')(app);
require('./app/messages/map.js')(app);
require('./app/messages/matrix.js')(app);

require('./app/messages/chat.js')(app);
require('./app/messages/help.js')(app);

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
if (BOT_MODE === 'callback') {
  app.http.post('/', app.bot.webhookCallback);
}
// The HTTP port is still needed in longpoll mode: it serves the /map pages.
require('./app/web/map.js')(app);
app.http.listen(process.env.PORT);

if (BOT_MODE === 'longpoll') {
  // node-vk-bot-api retries a failed poll immediately and forever, so a bad token or a
  // network outage would spin in a tight loop. On error, pause polling and resume later.
  const POLL_RETRY_MS = 5000;
  const onPoll = (err) => {
    if (!err) {
      console.info('bot started with longpoll, http at ' + process.env.PORT);
      return;
    }
    console.error('Long poll error, retrying in ' + POLL_RETRY_MS / 1000 + 's:', err.message || err);
    Sentry.captureException(err);
    app.bot.stop();
    setTimeout(() => {
      app.bot.isStopped = false;
      app.bot.startPolling(onPoll);
    }, POLL_RETRY_MS);
  };
  app.bot.startPolling(onPoll);
} else {
  console.info('bot started as callback at ' + process.env.PORT);
}


if (process.env.INCOMING_DEVICES_PORT != '') {
  require('./app/service/deviceReceiver.js')(app);
}

//restart instruction for developer:
//docker compose build hwmap-builder && docker compose up hwmap-builder -d && docker compose logs hwmap-builder -f
