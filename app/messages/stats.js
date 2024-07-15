module.exports = function(app) {
	const devicesCount = 256;
	const linkToDeviceCount = 3;
	app.bot.command('/stats', async (ctx) => {
		const subnet = await app.getSubnetFromMessage(ctx);
		if (subnet == null) {
			return;
		}

		const args = ctx.message.text.split(' ');
		let stats, length;
		let dates = app.getDates();

		if (args.length < 3) {
			stats = await app.dbUtil.stats(dates.day, subnet.id);
			length = subnet.length;
		} else {
			let rangeStart = parseInt(args[1], 16);
			let rangeEnd = parseInt(args[2], 16);
			if (isNaN(rangeStart) || isNaN(rangeEnd) || rangeStart >= rangeEnd) {
				ctx.reply('Некорректный диапазон');
			}

			stats = await app.dbUtil.stats(dates.day, subnet.id, rangeStart, rangeEnd);
			length = rangeEnd - rangeStart + 1;
		}

		const reply = "С последней перестройки карты обнаружено:\n Исходных устройств: "
			+ formatCount(stats.sources, length)
			+ "\n Целевых устройств: "
			+ formatCount(stats.targets, length)
		;
		ctx.reply(reply);



	});

	function formatCount(count, subnetLength) {
		const percentage = Math.floor(count / subnetLength * 100);
		return `${count} / ${subnetLength} (${percentage}%)`;
	}
}