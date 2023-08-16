module.exports = function(sequelize, models) {
    return {
        findLastBySubnet,
    }

    async function findLastBySubnet(subnetId) {
        let locations = await models.npcLocations.findAll({
            attributes: [
                sequelize.literal("DISTINCT ON (npc) id"),
                "npc",
                "device",
                "subnet",
                "messageDate",
                "vkUser",
                "isHit",
                "createdAt",
                "updatedAt",
                ],
            where: {
                subnet: subnetId
            },
            order: [
                ["npc"],
                ["messageDate", "DESC"],
            ],
        });

        return locations;
    }
}