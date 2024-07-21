module.exports = function(app) {
    app.bot.command('/subscribe', (ctx) => handleSubscribe(ctx));
    app.bot.command('/sub ', (ctx) => handleSubscribe(ctx));

    app.bot.command('/unsubscribe', (ctx) => handleUnsubscribe(ctx));
    app.bot.command('/unsub', (ctx) => handleUnsubscribe(ctx));
    
    app.bot.command('/subscriptions', (ctx) => handleSubList(ctx));
    app.bot.command('/sublist', (ctx) => handleSubList(ctx))
    app.bot.command('/subs', (ctx) => handleSubList(ctx))

    const handleSubscribe = async (ctx) => {
		const chat = await app.getChatFromMessage(ctx);
        if (chat == null) {
			return;
		}

        if (!chat.canSeeNpc) {
            ctx.reply('Чат не имеет доступа к NPC');
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
            where: {
                chat: chat.id,
                npc: npc.id,
            }
        });
        ctx.reply('Чат отписан от обновлений NPC ' + npc.name);
    }

    const handleSubList = async (ctx) => {
        const chat = await app.getChatFromMessage(ctx);
        if (chat == null) {
            return;
        }

        const subscriptions = await app.repository.chatNpc.getAllByChat(chat.id);
        if (subscriptions.length === 0 || subscriptions === null) {
            ctx.reply('Чат не подписан на обновления NPC');
            return;
        }

        const npcIds = subscriptions.map((sub) => sub.npc);
        const npcs = await app.repository.npc.getAllByIds(npcIds);
        const npcNames = npcs.map((npc) => npc.name).join("\n");
        const addition = chat.canSeeNpc
            ? ""
            : "\nЧат не имеет доступа к актуальным NPC, поэтому уведомления приходить не будут. Обратитесь к администратору бота.";

        ctx.reply("Чат подписан на обновления NPC:\n" + npcNames + addition);
    }
}