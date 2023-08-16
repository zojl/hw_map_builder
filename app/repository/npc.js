module.exports = function(sequelize, models) {
    return {
        getOneById,
        getOneByName,
    }

    async function getOneById(npcId) {
        let npc = await models.npcs.findOne({
            where: {
                id: npcId
            }
        });

        return npc;
    }

    async function getOneByName(npcName) {
        let npc = await models.npcs.findOne({
            where: {
                name: npcName
            }
        });

        return npc;
    }
}