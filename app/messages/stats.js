module.exports = function(app) {
	const devicesCount = 256;
	const linkToDeviceCount = 3;
	app.bot.command('/stats', async (ctx) => {
		const subnet = await app.getSubnetFromMessage(ctx);

		let dates = app.getDates();
		const stats = await app.dbUtil.stats(dates.day, subnet.id);
		const reply = "С последней перестройки карты обнаружено:\n Исходных устройств: "
			+ formatCount(stats.sources, subnet.length)
			+ "\n Целевых устройств: "
			+ formatCount(stats.targets, subnet.length)
			+ "\n Связей в сети: "
		    + formatCount(stats.connections, subnet.length * linkToDeviceCount)
		;
		ctx.reply(reply);
	});

	function formatCount(count, subnetLength) {
		const percentage = Math.floor(count / subnetLength * 100);
		return `${count} / ${subnetLength} (${percentage}%)`;
	}
}