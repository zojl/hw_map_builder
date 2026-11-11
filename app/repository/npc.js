module.exports = function(sequelize, models) {
    return {
        getOneById,
        getAllByIds,
        getOneByKey,
    }

    async function getOneById(npcId) {
        let npc = await models.npcs.findOne({
            where: {
                id: npcId
            }
        });

        return npc;
    }

    async function getAllByIds(npcIds) {
        return await models.npcs.findAll({
            where: {
                id: npcIds
            }
        });
    }

    // Case-insensitive lookup by the key from app/hw/parser.js
    async function getOneByKey(key) {
        return await models.npcs.findOne({
            where: sequelize.where(sequelize.fn('lower', sequelize.col('name')), sequelize.fn('lower', key))
        });
    }
}
