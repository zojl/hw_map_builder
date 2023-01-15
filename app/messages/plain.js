module.exports = function(app) {
	const extend = require('util')._extend;

	app.bot.on(async ctx => {
		let dates = app.getDates();
		const msg = ctx.message;
		if (typeof(msg.fwd_messages) == 'undefined' || msg.fwd_messages.length == 0) {
			ctx.reply('Пересылай сообщения от бота с 📟устройствами и вызывай /route xx yy для построения маршрутов.');
			return;
		}

		const now = new Date();
		const updateTime = new Date(now.getFullYear(), now.getMonth(), dates.dayOfMonth, 18);
		const updateTimeStamp = updateTime.getTime() / 1000;

		let replies = [];
		for (const src of msg.fwd_messages) {
			if (src.from_id != process.env.HW_BOT_ID) {
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

			const result = await app.dbUtil.pushToDB(device, connections, dates.day);
			if (result) {
				console.log('added ' + device + ' linked to ' + connections.join(' '));
				replies.push('Устройство 📟' + device + ' отмечено как связанное с 📟' + connections.join(', 📟'));
			}

			if (process.env.IS_STATBOT_ENABLED == 'true') {
				sendToStatBot(ctx.message.from_id, src.text);
			}
		};

		ctx.reply('Спасибо!\n' + replies.join('\n'));
	});

	function sendToStatBot(userId, message) {
		let apiDTO = extend({}, app.service.statBotApi.getDefaultDTO());
		apiDTO.ident = userId;

		let connectionsLine = null;
		const lines = message.split('\n')
		for (const index in lines) {
			const line = lines[index];
			const lineComponents = line.split(' ');

			if (line.startsWith('📟Устройство: ')) {
				apiDTO.device = parseInt(line.substring(line.length - 2), 16);
			}

			if (line.startsWith('👥Союзники: ')) {
				apiDTO.allies = parseInt(lineComponents[1]);
			}

			if (line.startsWith('👥Пользователи: ')) {
				apiDTO.users = parseInt(lineComponents[1]);
			}

			if (line === '🌐Подключения:') {
				connectionsLine = index;
			}

			if (
				connectionsLine !== null
				&& index <= parseInt(connectionsLine) + 3
				&& line.startsWith('📟')
			) {
				const deviceNumber = index - connectionsLine;
				apiDTO['device' + deviceNumber] = parseInt(line.substring(line.length - 2), 16);
			}
		}

		app.service.statBotApi.send(apiDTO);
	}
};