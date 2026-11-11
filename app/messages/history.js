const parser = require('../hw/parser.js');

// /history [name]: how NPCs changed over time (type, team, name spelling, level)
module.exports = function(app) {
    app.bot.command('/history', async (ctx) => {
        await handleHistory(ctx);
    });

    app.bot.command('/hist', async (ctx) => {
        await handleHistory(ctx);
    });

    // VK limits a message to 4096 characters
    const maxMessageLength = 4000;

    const handleHistory = async (ctx) => {
        const chat = await app.getChatFromMessage(ctx);
        if (chat === null) {
            return;
        }

        if (!chat.canSeeNpc) {
            ctx.reply('Эта команда не разрешена в этом чате.');
            return;
        }

        const name = ctx.message.text.split(' ').slice(1).join(' ').trim();
        let npcId = null;
        if (name !== '') {
            const npc = await app.repository.npc.getOneByKey(parser.lookupKeys(name).npc);
            if (npc === null) {
                ctx.reply('Не знаю NPC с таким именем');
                return;
            }
            npcId = npc.id;
        }

        const {summaries, changes} = await app.repository.npcLocation.findHistory(npcId);
        if (summaries.length === 0) {
            ctx.reply('Наблюдений из сообщений игры пока нет.');
            return;
        }

        const npcs = await app.repository.npc.getAllByIds(summaries.map((summary) => summary.npc));
        const npcNames = {};
        for (const npc of npcs) {
            npcNames[npc.id] = npc.name;
        }

        const changesByNpc = {};
        for (const change of changes) {
            changesByNpc[change.npc] = changesByNpc[change.npc] || [];
            changesByNpc[change.npc].push(change);
        }

        const blocks = summaries
            .sort((a, b) => npcNames[a.npc].localeCompare(npcNames[b.npc]))
            .map((summary) => formatNpc(summary, changesByNpc[summary.npc] || []));

        const title = npcId === null ? `История NPC (${blocks.length}):` : 'История NPC:';
        for (const message of splitMessages([title, ...blocks])) {
            await ctx.reply(message);
        }
    }

    function formatNpc(summary, changes) {
        const lines = [
            summary.raw,
            `Видели: ${formatDate(summary.firstSeen)} – ${formatDate(summary.lastSeen)}, наблюдений: ${summary.count}`,
        ];

        if (changes.length === 0) {
            lines.push('Изменений не было');
        }

        for (const change of changes) {
            const parts = [];
            if (change.type !== change.prevType) {
                parts.push(`тип ${parser.npcTypeLabel(change.prevType)} → ${parser.npcTypeLabel(change.type)}`);
            }
            if (change.team !== change.prevTeam) {
                parts.push(`команда ${parser.teamLabel(change.prevTeam)} → ${parser.teamLabel(change.team)}`);
            }
            if (change.name !== change.prevName) {
                parts.push(`имя ${change.prevName} → ${change.name}`);
            }
            if (change.level !== change.prevLevel) {
                parts.push(`уровень ${formatLevel(change.prevLevel)} → ${formatLevel(change.level)}`);
            }
            lines.push(`• ${formatDate(change.messageDate)}: ${parts.join(', ')}`);
        }

        return lines.join('\n');
    }

    function formatLevel(level) {
        // NULL is both a hidden level (░░) and none shown at all (older events)
        return level === null ? 'не виден' : String(level);
    }

    function formatDate(date) {
        return new Date(date).toLocaleString('ru-RU', {day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'});
    }

    // Joins blocks into messages under the VK limit, never splitting a block unless it alone is too long
    function splitMessages(blocks) {
        const messages = [];
        let current = '';
        for (const block of blocks) {
            const pieces = block.length > maxMessageLength ? splitLong(block) : [block];
            for (const piece of pieces) {
                if (current !== '' && current.length + 2 + piece.length > maxMessageLength) {
                    messages.push(current);
                    current = '';
                }
                current = current === '' ? piece : `${current}\n\n${piece}`;
            }
        }
        if (current !== '') {
            messages.push(current);
        }
        return messages;
    }

    function splitLong(block) {
        const pieces = [];
        let current = '';
        for (const line of block.split('\n')) {
            if (current !== '' && current.length + 1 + line.length > maxMessageLength) {
                pieces.push(current);
                current = '';
            }
            current = current === '' ? line : `${current}\n${line}`;
        }
        if (current !== '') {
            pieces.push(current);
        }
        return pieces;
    }
}
