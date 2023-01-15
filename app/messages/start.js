module.exports = function(bot, dbop, getDates) {
	bot.command('/start', (ctx) => {
		ctx.reply('Привет! Кидай мне сообщения с местоположениями устройств.');
	});
}