module.exports = function(sequelize, models) {
    return {
        getOneByChatAndService,
        getAllByChat,
        getAllByServiceIds,
    }

    async function getOneByChatAndService(chatId, serviceId) {
        return await models.chatServices.findOne({
            where: {
                service: serviceId,
                chat: chatId,
            }
        });
    }

    async function getAllByChat(chatId) {
        return await models.chatServices.findAll({
            where: {
                chat: chatId,
            }
        });
    }

    async function getAllByServiceIds(serviceIds) {
        if (serviceIds.length === 0) {
            return [];
        }

        return await models.chatServices.findAll({
            where: {
                service: serviceIds,
            }
        });
    }
}
