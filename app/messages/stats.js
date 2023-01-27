module.exports = function(app) {
	const devicesCount = 256;
	const linkToDeviceCount = 3;
	app.bot.command('/stats', async (ctx) => {
		let dates = app.getDates();
		const stats = await app.dbUtil.stats(dates.day);
		const reply = "С последней перестройки карты обнаружено:\n Исходных устройств: " + formatCount(stats.sources) + "\n Целевых устройств: " + formatCount(stats.targets);
		ctx.reply(reply);
	});

	function formatCount(count) {
		const percentage = Math.floor(count / devicesCount * 100);
		return `${count} / ${devicesCount} (${percentage}%)`;
	}
}