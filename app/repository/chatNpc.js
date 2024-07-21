module.exports = function(sequelize, models) {
    return {
        getOneByChatAndNpc,
        getAllByChat,
        getAllByNpcNames,
    }
    
    async function getOneByChatAndNpc(chatId, npcId) {
        return await models.chatNpcs.findOne({
            where: {
                npc: npcId,
                chat: chatId,
            }
        });
    }

    async function getAllByChat(chatId) {
        return await models.chatNpcs.findAll({
            where: {
                chat: chatId,
            }
        });
    }

    async function getAllByNpcNames(npcNames) {
        const npcs = await models.npcs.findAll({
            where: {
                name: npcNames
            }
        })
        if (npcs.length === 0 || npcs === null) {
            return [];
        }
        
        const npcIds = npcs.map(npc => npc.id);
        let requiredChats = {};
        let requiredNpcs = {};
        
        let chatNpcs = await models.chatNpcs.findAll({
            where: {
                npc: npcIds
            }
        });
        if (chatNpcs.length === 0 || npcs === null) {
            return [];
        }
        
        const chatIds = chatNpcs.map(chatNpc => chatNpc.chat);
        
        let chats = await models.chats.findAll({
            where: {
                id: chatIds
            }
        })
        
        for (const npc of npcs) {
            requiredNpcs[npc.id] = npc.name;
        }
        
        for (const chat of chats) {
            if (!chat.canSeeNpc) {
                continue;
            }
            requiredChats[chat.id] = chat.peerId;
        }
        
        let outChatNpcs = [];
        for (const chatNpc of chatNpcs) {
            if (typeof(requiredChats[chatNpc.chat]) === 'undefined') {
                continue;
            }

            outChatNpcs.push({
                chat: requiredChats[chatNpc.chat],
                npc: requiredNpcs[chatNpc.npc]
            });
        }
        
        return outChatNpcs;
    }
}