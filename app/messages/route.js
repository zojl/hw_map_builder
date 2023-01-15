module.exports = function(bot, dbop, getDates) {
	bot.command('/r', (ctx) => {
		handleCommand(ctx);
	})

	bot.command('/p', (ctx) => {
		handleCommand(ctx);
	})

	bot.command('/w', (ctx) => {
		handleCommand(ctx);
	})

	bot.command('/route', (ctx) => {
		handleCommand(ctx);
	})


	bot.command('/path', (ctx) => {
		handleCommand(ctx);
	})

	bot.command('/way', (ctx) => {
		handleCommand(ctx);
	})

	async function handleCommand(ctx) {
		let dates = getDates();
		const args = ctx.message.text.split(' ');
		if (args.length <= 2) {
			ctx.reply('Укажи исходное и конечное устройство, например /route 00 FF')
			return;
		}

		const result = await dbop.dijkstra(args[1], args[2], dates.day);
		console.log(result);
		if (result === null) {
			ctx.reply('У меня пока недостаточно данных о сегодняшних устройствах, чтобы построить такой маршрут.');
			return;
		}

		ctx.reply('Кратчайший известный машрут: ' + result.join(' => '));
	}
}