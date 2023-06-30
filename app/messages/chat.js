module.exports = function(app) {
    app.bot.command('/chat', async (ctx) => {
        ctx.reply('ID чата: ' + ctx.message.peer_id)
    });
}