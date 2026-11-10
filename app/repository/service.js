module.exports = function(sequelize, models) {
    return {
        getAllByIds,
    }

    async function getAllByIds(serviceIds) {
        return await models.services.findAll({
            where: {
                id: serviceIds
            }
        });
    }
}
