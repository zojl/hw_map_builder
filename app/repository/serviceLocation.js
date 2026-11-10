module.exports = function(sequelize, models) {
    return {
        findLastByServicesAndSubnet,
    }

    // Latest known location of each given service in the subnet
    async function findLastByServicesAndSubnet(serviceIds, subnetId) {
        if (serviceIds.length === 0) {
            return [];
        }

        return await models.serviceLocations.findAll({
            attributes: [
                sequelize.literal("DISTINCT ON (service) id"),
                "service",
                "device",
                "subnet",
                "day",
                "messageDate",
                "vkUser",
                "createdAt",
                "updatedAt",
            ],
            where: {
                service: serviceIds,
                subnet: subnetId,
            },
            order: [
                ["service"],
                ["messageDate", "DESC"],
            ],
        });
    }
}
