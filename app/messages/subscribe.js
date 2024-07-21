module.exports = function(app) {
    app.bot.command('/subscribe', (ctx) => handleSubscribe(ctx));
    app.bot.command('/sub', (ctx) => handleSubscribe(ctx));
    app.bot.command('/unsubscribe', (ctx) => handleUnsubscribe(ctx));
    app.bot.command('/unsub', (ctx) => handleUnsubscribe(ctx));
    
    const handleSubscribe = async (ctx) => {
		const chat = await app.getChatFromMessage(ctx);
        if (chat == null) {
			return;
		}

		const args = ctx.message.text.split(' ');

		if (args.length < 2) {
			ctx.reply('Отправь имя бота (без префикса), чтобы подписать чат на его обновления (например, «/sub 🎯💣D3t3c7 (35)»)');
            return;
		}
        
        const npcName = args.slice(1).join(' ');
        const npc = await app.repository.npc.getOneByName(npcName);
        if (npc === null) {
            ctx.reply('Некорректное имя NPC');
            return;
        }
        
        const existingSubscription = await app.repository.chatNpc.getOneByChatAndNpc(chat.id, npc.id);
        if (existingSubscription !== null) {
            ctx.reply('Вы уже подписаны на этого NPC в этом чате');
            return;
        }
        
        await app.model.chatNpcs.create({
            chat: chat.id,
            npc: npc.id,
        });
        ctx.reply('Чат подписан на обновления NPC ' + npc.name);
    }
    
    const handleUnsubscribe = async (ctx) => {
		const chat = await app.getChatFromMessage(ctx);
        if (chat == null) {
			return;
		}

		const args = ctx.message.text.split(' ');

		if (args.length < 2) {
			ctx.reply('Отправь имя бота (без префикса), чтобы отписать чат от его обновлений (например, «/sub 🎯💣D3t3c7 (35)»)');
            return;
		}
        
        const npcName = args.slice(1).join(' ');
        const npc = await app.repository.npc.getOneByName(npcName);
        if (npc === null) {
            ctx.reply('Некорректное имя NPC');
            return;
        }
        
        const existingSubscription = await app.repository.chatNpc.getOneByChatAndNpc(chat.id, npc.id);
        if (existingSubscription === null) {
            ctx.reply('Вы не подписаны на этого NPC в этом чате');
            return;
        }
        
        await app.model.chatNpcs.destroy({
            chat: chat.id,
            npc: npc.id,
        });
        ctx.reply('Чат отписан от обновлений NPC ' + npc.name);
    }
}