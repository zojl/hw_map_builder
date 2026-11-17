// Notifies subscribed chats when an NPC or a service moves to another device.
// Moves come from dbPusher.pushNpcs / pushServices.
module.exports = (app) => {
    const ttl = 15 * 60 * 1000;
    const freshTime = 60 * 1000;

    return {
        notifyMoves,
    }

    // sourcePeerId: the chat the data came from (it already knows), null for vhack.info
    async function notifyMoves(sourcePeerId, moves, deviceFull, timestamp) {
        if (moves === null || moves.length === 0) {
            return;
        }

        const timeDiff = Date.now() - timestamp;
        if (timeDiff > ttl) {
            return;
        }
        const timeDiffMessage = timeDiff >= freshTime ? ` (${Math.floor(timeDiff / 60000)} мин. назад)` : '';

        const npcMoves = moves.filter((move) => move.kind === 'npc');
        const serviceMoves = moves.filter((move) => move.kind === 'service');
        const subscriptions = [
            ...(await app.repository.chatNpc.getAllByNpcIds(npcMoves.map((move) => move.id)))
                .map((sub) => ({chat: sub.chat, raw: npcMoves.find((move) => move.id === sub.npc).raw})),
            ...(await app.repository.chatService.getAllByServiceIds(serviceMoves.map((move) => move.id)))
                .map((sub) => ({chat: sub.chat, raw: serviceMoves.find((move) => move.id === sub.service).raw})),
        ];
        if (subscriptions.length === 0) {
            return;
        }

        const chats = await app.repository.chat.getAllByIds([...new Set(subscriptions.map((sub) => sub.chat))]);
        const peerIds = {};
        for (const chat of chats) {
            if (chat.canSeeNpc && chat.peerId !== sourcePeerId) {
                peerIds[chat.id] = chat.peerId;
            }
        }

        const rawsByPeer = {};
        for (const sub of subscriptions) {
            const peerId = peerIds[sub.chat];
            if (typeof(peerId) === 'undefined') {
                continue;
            }
            rawsByPeer[peerId] = rawsByPeer[peerId] || [];
            if (!rawsByPeer[peerId].includes(sub.raw)) {
                rawsByPeer[peerId].push(sub.raw);
            }
        }

        for (const [peerId, raws] of Object.entries(rawsByPeer)) {
            const foundPlural = raws.length > 1 ? 'обнаружены' : 'обнаружен';
            try {
                await app.bot.sendMessage(peerId, `${raws.join(', ')} ${foundPlural} на 📟${deviceFull}${timeDiffMessage}`);
            } catch (error) {
                // One chat failing (e.g. the bot was kicked) must not stop the others
                console.error(`Notification to ${peerId} failed:`, error);
                app.sentry.captureException(error);
            }
        }
    }
}
