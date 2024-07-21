module.exports = (app) => {
    return {
        notifyChats
    }

    async function notifyChats(sourceChatId, npcNames, deviceCode) {
        const recipients = await app.repository.chatNpc.getAllByNpcNames(npcNames);
        let npcsByChats = [];
        for (const recipient of recipients) {
            if (recipient.chat === sourceChatId) {
                continue;
            }
            
            if (typeof(npcsByChats[recipient.chat]) == 'undefined') {
                npcsByChats[recipient.chat] = [];
            }
            npcsByChats[recipient.chat].push(recipient.npc)
        }
        
        for (const peerId in npcsByChats) {
            const foundPlural = npcsByChats[peerId].length > 1 ? 'обнаружены' : 'обнаружен';
            const message = npcsByChats[peerId].join(", ") + " " + foundPlural + " на 📟" + deviceCode;
            app.bot.sendMessage(peerId, message);
        }
    }
}