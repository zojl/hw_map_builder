// /help: the commands this chat can use. Like the commands themselves it works only in chats
// with a subnet, and lists NPC and service commands (and /history) only where the chat may use them.
module.exports = function(app) {
    app.bot.command('/help', async (ctx) => {
        await handleHelp(ctx);
    });

    app.bot.command('/помощь', async (ctx) => {
        await handleHelp(ctx);
    });

    const handleHelp = async (ctx) => {
        const chat = await app.getChatFromMessage(ctx);
        if (chat === null) {
            return;
        }

        const sections = [];

        const forwarding = ['Пересылай боту сообщения игры с 📟устройствами: их связи попадут на карту.'];
        if (process.env.IS_VHINFO_ENABLED === 'true') {
            forwarding.push('Добавь к пересылке текст /s, чтобы не отправлять данные в Vhack Info.');
        }
        sections.push(forwarding.join('\n'));

        sections.push([
            'Пути:',
            '/route 00 AA BB — кратчайшие пути от 00 до каждого из устройств (/r, /p, /w)',
            '/traverse 55 40-7F — обход диапазона 40–7F, начиная с 55 (/t)',
            '/find 00 AA BB — пути до устройств через каждую из связей 00 (/f)',
            '/cycle 00 — кратчайшие пути, которые возвращаются в 00 (/c)',
            '/analyse 00 — пути от 00 до ближайших неисследованных устройств (/a)',
        ].join('\n'));

        const mapLines = [
            'Карта:',
            '/links 00 — с какими устройствами связано 00 (/l)',
            '/reverselinks 00 — какие устройства связаны с 00 (/rl)',
            '/matrix 00 0F — связи диапазона в виде сетки, если они её образуют',
            '/stats [00 7F] — сколько устройств уже найдено, во всей подсети или в диапазоне',
        ];
        if (chat.canSeeMap && app.service.mapLink.isEnabled()) {
            mapLines.push('/map — ссылка на карту подсети');
        }
        sections.push(mapLines.join('\n'));

        const npcLines = [];
        if (chat.canSeeNpc) {
            npcLines.push(
                '/npc [00] — где NPC за последние сутки; с устройством — ещё и пути от него',
                '/svc [00] — последние перемещения сервисов; с устройством — ещё и пути от него (/service)',
            );
        }
        if (chat.canSeeHistory) {
            npcLines.push('/history [имя] — как менялись NPC: тип, команда, имя, уровень (/hist)');
        }
        if (chat.canSeeNpc) {
            npcLines.push(
                '/sub имя — подписать чат на перемещения NPC или сервиса',
                '/unsub имя — отписать чат',
                '/subs — на что подписан чат',
            );
        }
        if (npcLines.length > 0) {
            sections.push(['NPC и сервисы:', ...npcLines].join('\n'));
        }

        ctx.reply(sections.join('\n\n'));
    }
}
