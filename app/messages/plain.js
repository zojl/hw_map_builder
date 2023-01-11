module.exports = function(bot, dbop, dates) {
	bot.on(async ctx => {
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

			const result = await dbop.pushToDB(device, connections, dates.day);
			if (result) {
				console.log('added ' + device + ' linked to ' + connections.join(' '));
				replies.push('Устройство 📟' + device + ' отмечено как связанное с 📟' + connections.join(', 📟'));
			}
		};

		ctx.reply('Спасибо!\n' + replies.join('\n'));
	});
};