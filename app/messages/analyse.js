module.exports = function(app) {
	app.bot.command('/analyse', (ctx) => {
		handleCommand(ctx);
	});

	app.bot.command('/a', (ctx) => {
		handleCommand(ctx);
	})

	async function handleCommand(ctx) {
		let dates = app.getDates();

		const args = ctx.message.text.split(' ');
		if (args.length <= 1) {
			ctx.reply('Укажи устройство, на котором находишься, например /analyse 00')
			return;
		}

		const deviceCode = args[1];
		const sourceDeviceEntity = await app.repository.device.getOneByCode(deviceCode)
		if (sourceDeviceEntity == null) {
			ctx.reply('Такого устройства нет в базе: не встречалось ещё никому за время ивента.');
			return;
		}

		const deviceConnections = await app.repository.connection.getAllBySourceAndDay(sourceDeviceEntity.id, dates.day)

		if (deviceConnections.length == 0) {
			ctx.reply('Этого устройства нет на сегодняшней карте. Перешли сообщение с его связями, если посещал его.');
			return;
		}

		const level1Connections = await app.dbUtil.unvisited.getByConnectionsAndDay(deviceConnections, dates.day);
		if (level1Connections.notFound.length > 0) {
			ctx.reply('Это устройство связано со следующими неисследованными: ' + level1Connections.notFound.join(', '));
			return;
		}

		ctx.reply('Не удалось найти ближайшие неисследованные устройства.');
	}
}