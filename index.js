require('dotenv').config()
const VkBot = require('node-vk-bot-api');
const Sequelize   = require('sequelize');

const bot = new VkBot(process.env.TOKEN);
const hwBotId = -172959149;

const db = new Sequelize(process.env.DB);
db.Op = Sequelize.Op;
let models = {};
models.devices = require('./models/devices.js')(db, Sequelize);
models.devices.sync();
models.connections = require('./models/connections.js')(db, Sequelize);
models.connections.sync();
db.query("CREATE EXTENSION PostGIS;");
db.query("CREATE EXTENSION pgRouting;");

const pushToDB = require('./dbPusher.js')(db, models);
const dijkstra = require('./dijkstra.js')(db, models);

bot.command('/start', (ctx) => {
  ctx.reply('Привет! Кидай мне сообщения с местоположениями устройств.');
});

bot.command('/route', async (ctx) => {
  const args = ctx.message.text.split(' ');
  if (args.length <= 2) {
    ctx.reply('Укажи исходное и конечное устройство, например /route 00 FF')
    return;
  }

  const result = await dijkstra(args[1], args[2]);
  console.log(result);
  if (result === null) {
    ctx.reply('У меня пока недостаточно данных о сегодняшних устройствах, чтобы построить такой маршрут.');
    return;
  }
  
  ctx.reply('Кратчайший известный машрут: ' + result.join(' => '));
})

bot.on(async ctx => {
  const msg = ctx.message;
  if (typeof(msg.fwd_messages) == 'undefined') {
    return;
  }

  const now = new Date();
  const dates = getDates();
  const updateTime = new Date(now.getFullYear(), now.getMonth(), dates.dayOfMonth, 18);
  const updateTimeStamp = updateTime.getTime() / 1000;

  let replies = [];
  for (const src of msg.fwd_messages) {
    if (src.from_id != hwBotId) {
      return;
    }

    if (src.date < updateTimeStamp) {
      return;
    }

    if (!src.text.startsWith('📟Устройство:')) {
      return;
    }

    if (!src.text.includes('\n🌐Подключения:')) {
      return;
    }

    const lines = src.text.split('\n');
    let device = lines[0].substring(lines[0].length - 8);
    let connections = [];
    let foundConnection = false;
    lines.forEach(line => {
      if (foundConnection) {
        if (line.startsWith('📟') && connections.length < 3) {
          connections.push(line.substring(2));
        }
        return;
      }

      if (line === '🌐Подключения:') {
        foundConnection = true;
      }
    });

    const result = await pushToDB(device, connections, dates.day);
    if (result) {
      console.log('added ' + device + ' linked to ' + connections.join(' '));
      replies.push('Устройство 📟' + device + ' отмечено как связанное с 📟' + connections.join(', 📟'));
    }
  };

  ctx.reply('Спасибо!\n' + replies.join('\n'));
});

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
