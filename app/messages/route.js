module.exports = function(app) {
	app.bot.command('/r', (ctx) => {
		handleCommand(ctx);
	})

	app.bot.command('/p', (ctx) => {
		handleCommand(ctx);
	})

	app.bot.command('/w', (ctx) => {
		handleCommand(ctx);
	})

	app.bot.command('/route', (ctx) => {
		handleCommand(ctx);
	})


	app.bot.command('/path', (ctx) => {
		handleCommand(ctx);
	})

	app.bot.command('/way', (ctx) => {
		handleCommand(ctx);
	})

	async function handleCommand(ctx) {
		let dates = app.getDates();
		const args = ctx.message.text.split(' ');
		if (args.length <= 2) {
			ctx.reply('Укажи исходное и конечное устройство, например /route 00 FF');
			return;
		}

		const result = await app.dbUtil.dijkstra(args[1], args[2], dates.day);
		console.log(result);
		if (result === null) {
			ctx.reply('У меня пока недостаточно данных о сегодняшних устройствах, чтобы построить такой маршрут.');
			return;
		}

		const cost = result.length - 1;
		const route = result.join(' → ');
		ctx.reply(`⚡${cost}: ${route}`);
	}
}