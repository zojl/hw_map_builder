module.exports = function(sequelize, models) {
    return {
        getOneById,
        getOneByName,
        getAllByNamePart,
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

    async function getAllByNamePart(npcNamePart) {
        let npcs = await models.npcs.findAll({
            where: {
                name: {
                    [sequelize.Op.like]: npcNamePart
                }
            }
        });

        return npcs;
    }
}