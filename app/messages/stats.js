module.exports = function(bot, dbop, dates) {
	const devicesCount = 256;
	const linkToDeviceCount = 3;
	bot.command('/stats', async (ctx) => {
		const data = await dbop.stats(dates.day);
		const reply = "С последней перестройки карты обнаружено:\n Исходных устройств: " + formatCount(data.sources) + "\n Целевых устройств: " + formatCount(data.targets);
		ctx.reply(reply);
	});

	function formatCount(count) {
		const percentage = Math.floor(count / devicesCount * 100);
		return `${count} / ${devicesCount} (${percentage}%)`;
	}
}