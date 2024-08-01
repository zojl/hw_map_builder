module.exports = (app) => {
    return {
        notifyChats
    }


    async function notifyChats(sourceChatId, npcNames, deviceCode, timestamp) {
        const npcTTL = 900000; //15 min
        const npcFreshTime = 60000; //1 min

        const currentDate = new Date();
        const messageDate = new Date(timestamp);
        const timeDiff = currentDate.getTime() - messageDate.getTime();
        
        if (timeDiff > npcTTL) {
            return;
        }
        let timeDiffMessage = "";
        if (timeDiff >= npcFreshTime) {
            const minutes = Math.floor(timeDiff / 60000);
            timeDiffMessage = ` (${minutes} мин. назад)`;
        }

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
            const message = npcsByChats[peerId].join(", ") + " " + foundPlural + " на 📟" + deviceCode + timeDiffMessage;
            app.bot.sendMessage(peerId, message);
        }
    }
}