require('dotenv').config()
const VkBot = require('node-vk-bot-api');
const bot = new VkBot(process.env.TOKEN);

const Sequelize   = require('sequelize');
const db = new Sequelize(process.env.DB);

db.Op = Sequelize.Op;
let models = {};
models.devices = require('./app/models/devices.js')(db, Sequelize);
models.devices.sync();
models.connections = require('./app/models/connections.js')(db, Sequelize);
models.connections.sync();
db.query("CREATE EXTENSION PostGIS;");
db.query("CREATE EXTENSION pgRouting;");

let dbop = {};
dbop.pushToDB = require('./app/dbop/dbPusher.js')(db, models);
dbop.dijkstra = require('./app/dbop/dijkstra.js')(db, models);
dbop.stats = require('./app/dbop/stats.js')(db, models);

require('./app/messages/start.js')(bot, dbop, getDates());
require('./app/messages/route.js')(bot, dbop, getDates());
require('./app/messages/stats.js')(bot, dbop, getDates());

require('./app/messages/plain.js')(bot, dbop, getDates());

function getDates() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = (now - start) + ((start.getTimezoneOffset() - now.getTimezoneOffset()) * 60 * 1000);
  const oneDay = 1000 * 60 * 60 * 24;
  let day = Math.floor(diff / oneDay);
  let dayOfMonth = now.getDate();
  if (now.getHours() < 18) {
    day--;

    if (dayOfMonth == 1) {
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

bot.startPolling();
