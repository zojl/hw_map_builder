require('dotenv').config()
const VkBot = require('node-vk-bot-api');
const Sequelize   = require('sequelize');

const bot = new VkBot(process.env.TOKEN);
const hwBotId = -172959149;

const db = new Sequelize({
  dialect: 'sqlite',
  storage: __dirname + '/db/bot.db',
  logging: false
});
db.Op = Sequelize.Op;
let models = {};
models.devices = require('./models/devices.js')(db, Sequelize);
models.devices.sync();
models.connections = require('./models/connections.js')(db, Sequelize);
models.connections.sync();

const pushToDB = require('./dbPusher.js')(db, models);

bot.command('/start', (ctx) => {
  ctx.reply('Привет! Кидай мне сообщения с местоположениями девайсов.');
});

bot.on(async ctx => {
  const msg = ctx.message;
  if (typeof(msg.fwd_messages) == 'undefined') {
    return;
  }

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
  const updateTime = new Date(now.getFullYear(), now.getMonth(), dayOfMonth, 18);
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

    const result = await pushToDB(device, connections, day);
    if (result) {
      console.log('added ' + device + ' linked to ' + connections.join(' '));
      replies.push('Устройство 📟' + device + ' отмечено как связанное с 📟' + connections.join(', 📟'));
    }
  };

  ctx.reply('Спасибо!\n' + replies.join('\n'));
});

bot.startPolling();
