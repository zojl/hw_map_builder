module.exports = function(app) {
	app.bot.command('/start', (ctx) => {
		ctx.reply('Привет! Кидай мне сообщения с местоположениями устройств.');
	});
}