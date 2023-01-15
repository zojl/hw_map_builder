module.exports = function(bot, dbop, getDates) {
	bot.command('/route', async (ctx) => {

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
	})
}