module.exports = function(sequelize, models) {
    return {
        getOneByChatAndNpc,
        getAllByChat,
        getAllByNpcIds,
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

    async function getAllByNpcIds(npcIds) {
        if (npcIds.length === 0) {
            return [];
        }

        return await models.chatNpcs.findAll({
            where: {
                npc: npcIds,
            }
        });
    }
}
