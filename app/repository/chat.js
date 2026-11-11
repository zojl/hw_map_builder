module.exports = function(sequelize, models) {
    return {
        getOneByPeerId,
        getAllByIds,
    }

    async function getAllByIds(ids) {
        if (ids.length === 0) {
            return [];
        }

        return await models.chats.findAll({
            where: {
                id: ids
            }
        });
    }

    async function getOneByPeerId(peerId) {
        /*if (peerId <= 2000000000) {
            return null;
        }*/
        
        let chat = await models.chats.findOne({
            where: {
                peerId: peerId
            }
        });

        return chat;
    }
}