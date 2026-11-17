// /map: a link to the subnet map page (app/web/map.js) for the chat's subnet
module.exports = function(app) {
    app.bot.command('/map', async (ctx) => {
        await handleMap(ctx);
    });

    const handleMap = async (ctx) => {
        const chat = await app.getChatFromMessage(ctx);
        if (chat === null) {
            return;
        }

        if (!app.service.mapLink.isEnabled()) {
            ctx.reply('Карта не настроена на сервере.');
            return;
        }

        const token = app.service.mapLink.create(chat.id, ctx.message.from_id);
        const minutes = app.service.mapLink.ttlSeconds / 60;
        ctx.reply(`Карта подсети: ${app.service.mapLink.url(token)}\nСсылку можно открыть в течение ${minutes} минут.`);
    }
}
