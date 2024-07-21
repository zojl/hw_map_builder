module.exports = function(sequelize, models) {
    return {
        getOneByChatAndNpc,
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

    async function getAllByNpcNames(npcNames) {
        const npcs = await models.npcs.findAll({
            where: {
                name: npcNames
            }
        })
        if (npcs.length === 0) {
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
        if (chatNpcs.length === 0) {
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
            requiredChats[chat.id] = chat.peerId;
        }
        
        let outChatNpcs = [];
        for (const chatNpc of chatNpcs) {
            outChatNpcs.push({
                chat: requiredChats[chatNpc.chat],
                npc: requiredNpcs[chatNpc.npc]
            });
        }
        
        return outChatNpcs;
    }
}