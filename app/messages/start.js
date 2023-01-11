module.exports = function(bot, dbop, dates) {
	bot.command('/start', (ctx) => {
		ctx.reply('Привет! Кидай мне сообщения с местоположениями устройств.');
	});
}