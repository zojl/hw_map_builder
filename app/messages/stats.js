module.exports = function(app) {
	const devicesCount = 256;
	const linkToDeviceCount = 3;
	app.bot.command('/stats', async (ctx) => {
		const chat = await app.repository.chat.getOneByPeerId(ctx.message.peer_id)

		const subnet = await app.repository.subnet.getOneById(chat.subnet);

		if (chat === null) {
			ctx.reply('Эта команда работает только в чатах, которым назначены подсети в боте.');
			return;
		}

		let dates = app.getDates();
		const stats = await app.dbUtil.stats(dates.day, subnet.id);
		const reply = "С последней перестройки карты обнаружено:\n Исходных устройств: " + formatCount(stats.sources, subnet.length) + "\n Целевых устройств: " + formatCount(stats.targets, subnet.length);
		ctx.reply(reply);
	});

	function formatCount(count, subnetLength) {
		const percentage = Math.floor(count / subnetLength * 100);
		return `${count} / ${subnetLength} (${percentage}%)`;
	}
}