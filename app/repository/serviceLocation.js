module.exports = function(sequelize, models) {
    return {
        findLastByServicesAndSubnet,
        findLastBySubnetAndDay,
    }

    // Latest known location of each given service in the subnet
    async function findLastByServicesAndSubnet(serviceIds, subnetId) {
        if (serviceIds.length === 0) {
            return [];
        }

        return await findLast({
            service: serviceIds,
            subnet: subnetId,
        });
    }

    // Latest known location of every service seen in the subnet on the given day
    async function findLastBySubnetAndDay(subnetId, day) {
        return await findLast({
            subnet: subnetId,
            day: day,
        });
    }

    async function findLast(where) {
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
            where: where,
            order: [
                ["service"],
                ["messageDate", "DESC"],
            ],
        });
    }
}
