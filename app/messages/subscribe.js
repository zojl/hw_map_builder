const parser = require('../hw/parser.js');

// Subscriptions to NPC and service moves. A name may match both: then both are (un)subscribed.
module.exports = function(app) {
    app.bot.command('/subscribe', (ctx) => handleSubscribe(ctx));
    app.bot.command('/sub ', (ctx) => handleSubscribe(ctx));

    app.bot.command('/unsubscribe', (ctx) => handleUnsubscribe(ctx));
    app.bot.command('/unsub', (ctx) => handleUnsubscribe(ctx));

    app.bot.command('/subscriptions', (ctx) => handleSubList(ctx));
    app.bot.command('/sublist', (ctx) => handleSubList(ctx))
    app.bot.command('/subs', (ctx) => handleSubList(ctx))

    // NPC and/or service matching the typed name, in any form ("Pivot1ng", "🚸💣Pivot1ng (36)")
    async function findTargets(input) {
        const keys = parser.lookupKeys(input);
        return {
            npc: await app.repository.npc.getOneByKey(keys.npc),
            service: await app.repository.service.getOneByKey(keys.service),
        };
    }

    function getName(ctx) {
        return ctx.message.text.split(' ').slice(1).join(' ').trim();
    }

    const handleSubscribe = async (ctx) => {
        const chat = await app.getChatFromMessage(ctx);
        if (chat == null) {
            return;
        }

        if (!chat.canSeeNpc) {
            ctx.reply('Чат не имеет доступа к NPC и сервисам');
            return;
        }

        const name = getName(ctx);
        if (name === '') {
            ctx.reply('Отправь имя NPC или сервиса, чтобы подписать чат на его перемещения (например, «/sub D3t3c7» или «/sub Pasta»)');
            return;
        }

        const {npc, service} = await findTargets(name);
        if (npc === null && service === null) {
            ctx.reply('Не знаю NPC или сервиса с таким именем');
            return;
        }

        const replies = [];
        if (npc !== null) {
            if (await app.repository.chatNpc.getOneByChatAndNpc(chat.id, npc.id) !== null) {
                replies.push(`Чат уже подписан на NPC ${npc.name}`);
            } else {
                await app.model.chatNpcs.create({chat: chat.id, npc: npc.id});
                replies.push(`Чат подписан на перемещения NPC ${npc.name}`);
            }
        }

        if (service !== null) {
            if (await app.repository.chatService.getOneByChatAndService(chat.id, service.id) !== null) {
                replies.push(`Чат уже подписан на сервис ${service.name}`);
            } else {
                await app.model.chatServices.create({chat: chat.id, service: service.id});
                replies.push(`Чат подписан на перемещения сервиса ${service.name}`);
            }
        }

        ctx.reply(replies.join('\n'));
    }

    const handleUnsubscribe = async (ctx) => {
        const chat = await app.getChatFromMessage(ctx);
        if (chat == null) {
            return;
        }

        const name = getName(ctx);
        if (name === '') {
            ctx.reply('Отправь имя NPC или сервиса, чтобы отписать чат от его перемещений (например, «/unsub D3t3c7»)');
            return;
        }

        const {npc, service} = await findTargets(name);
        const replies = [];

        if (npc !== null && await app.repository.chatNpc.getOneByChatAndNpc(chat.id, npc.id) !== null) {
            await app.model.chatNpcs.destroy({where: {chat: chat.id, npc: npc.id}});
            replies.push(`Чат отписан от NPC ${npc.name}`);
        }

        if (service !== null && await app.repository.chatService.getOneByChatAndService(chat.id, service.id) !== null) {
            await app.model.chatServices.destroy({where: {chat: chat.id, service: service.id}});
            replies.push(`Чат отписан от сервиса ${service.name}`);
        }

        ctx.reply(replies.length > 0 ? replies.join('\n') : 'Чат не подписан на NPC или сервис с таким именем');
    }

    const handleSubList = async (ctx) => {
        const chat = await app.getChatFromMessage(ctx);
        if (chat == null) {
            return;
        }

        const npcSubs = await app.repository.chatNpc.getAllByChat(chat.id);
        const serviceSubs = await app.repository.chatService.getAllByChat(chat.id);
        if (npcSubs.length === 0 && serviceSubs.length === 0) {
            ctx.reply('Чат не подписан на перемещения NPC и сервисов');
            return;
        }

        const parts = [];
        if (npcSubs.length > 0) {
            const npcs = await app.repository.npc.getAllByIds(npcSubs.map((sub) => sub.npc));
            parts.push('NPC:\n' + npcs.map((npc) => npc.name).join('\n'));
        }

        if (serviceSubs.length > 0) {
            const services = await app.repository.service.getAllByIds(serviceSubs.map((sub) => sub.service));
            parts.push('Сервисы:\n' + services.map((service) => service.name).join('\n'));
        }

        const addition = chat.canSeeNpc
            ? ''
            : '\n\nЧат не имеет доступа к NPC и сервисам, поэтому уведомления приходить не будут. Обратитесь к администратору бота.';

        ctx.reply('Чат подписан на перемещения:\n\n' + parts.join('\n\n') + addition);
    }
}
