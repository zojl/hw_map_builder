module.exports = function(app) {
	const extend = require('util')._extend;

	app.bot.on(async ctx => {
		let dates = app.getDates();
		const msg = ctx.message;
		if (typeof(msg.fwd_messages) == 'undefined' || msg.fwd_messages.length == 0) {
			sendHelp(ctx);
			return;
		}

		const now = new Date();
		const updateTime = new Date(now.getFullYear(), now.getMonth(), dates.dayOfMonth, 18);
		const updateTimeStamp = updateTime.getTime() / 1000;

		let replies = [];
		let lastDevice = null;
		for (const src of msg.fwd_messages) {
			if (src.from_id != process.env.HW_BOT_ID) {
				continue;
			}

			if (src.date < updateTimeStamp) {
				continue;
			}

			if (!src.text.startsWith('📟Устройство:')) {
				continue;
			}

			if (!src.text.includes('\n🌐Подключения:')) {
				continue;
			}

			const lines = src.text.split('\n');
			let device = lines[0].substring(lines[0].length - 8);
			let connections = [];
			let foundConnection = false;
			for (const line of lines) {
				if (foundConnection) {
					if (line.startsWith('📟') && connections.length < 3) {
						connections.push(line.substring(2));
					}

					continue;
				}

				if (line === '🌐Подключения:') {
					foundConnection = true;
				}
			};

			const result = await app.dbUtil.pushToDB(device, connections, dates.day);
			if (result) {
				console.log('added ' + device + ' linked to ' + connections.join(' '));
				replies.push('Устройство 📟' + device + ' отмечено как связанное с 📟' + connections.join(', 📟'));
			}
			lastDevice = device;

			if (process.env.IS_STATBOT_ENABLED == 'true') {
				sendToStatBot(ctx.message.from_id, src.text);
			}
		};

		if (lastDevice !== null) {
			let unvisitedMessage = '\n' + await getUnknownConnections(lastDevice, dates.day);
			ctx.reply('Спасибо!\n' + replies.join('\n') + unvisitedMessage);
			return;
		}

		sendHelp(ctx);
	});

	function sendHelp(ctx) {
		ctx.reply('Пересылай сообщения от бота с 📟устройствами и вызывай /route xx yy для построения маршрутов.');
	}

	async function getUnknownConnections(deviceCode, day) {
		const device = await app.repository.device.getOneByCode(deviceCode);
		const unvisited = await app.dbUtil.unvisited.getBySourceIdAndDay(device.id, day);
		if (unvisited.notFound.length == 0) {
			return 'Все 📟устройства, связанные с 📟' + deviceCode + ' уже были исследованы';
		}

		return '📟Устройство ' + deviceCode + ' связано со следующими неисследованными: 📟' + unvisited.notFound.join(', 📟');
	}

	function sendToStatBot(userId, message) {
		let apiDTO = extend({}, app.service.vHackApi.getDefaultDTO());
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

			if (line.startsWith('🎯💣')) {
				apiDTO.npcs.push({
					"name": line.substring('🎯'.length),
					"npc": 4, // # 0 - неизвестен, 1 - смотрит (на 00), 2 - босс (старый), 3 - торговец, 4 - отслеживаемый
					"type": "nu"
				})
			}

			if (
				line.startsWith('⚖💣')
				|| line.startsWith('⚖🔸')
			) {
				apiDTO.npcs.push({
					"name": line.substring('⚖'.length),
					"npc": 3,
					"type": "nu"
				})
			}

			if (line.startsWith('⚔💣')) {
				apiDTO.npcs.push({
					"name": line.substring('⚔'.length),
					"npc": 2,
					"type": "nu"
				})
			}

			if (line.startsWith('👀')) {
				apiDTO.npcs.push({
					"name": line.substring('👀'.length),
					"npc": 1,
					"type": "nu"
				})
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

		app.service.vHackApi.send(apiDTO);
	}
};