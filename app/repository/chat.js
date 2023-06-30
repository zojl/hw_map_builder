module.exports = function(sequelize, models) {
    return {
        getOneByPeerId
    }

    async function getOneByPeerId(peerId) {
        if (peerId <= 2000000000) {
            return null;
        }
        
        let chat = await models.chats.findOne({
            where: {
                peerId: peerId
            }
        });

        return chat;
    }
}