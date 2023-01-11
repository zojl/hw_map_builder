module.exports = function(bot, dbop, dates) {
	bot.command('/route', async (ctx) => {
		console.log(ctx);

		const args = ctx.message.text.split(' ');
		if (args.length <= 2) {
			ctx.reply('Укажи исходное и конечное устройство, например /route 00 FF')
			return;
		}

		const result = await dbop.dijkstra(args[1], args[2]);
		console.log(result);
		if (result === null) {
			ctx.reply('У меня пока недостаточно данных о сегодняшних устройствах, чтобы построить такой маршрут.');
			return;
		}

		ctx.reply('Кратчайший известный машрут: ' + result.join(' => '));
	})
}