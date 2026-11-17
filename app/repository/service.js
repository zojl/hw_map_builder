module.exports = function(sequelize, models) {
    return {
        getAllByIds,
        getOneByKey,
    }

    async function getAllByIds(serviceIds) {
        return await models.services.findAll({
            where: {
                id: serviceIds
            }
        });
    }

    // Case-insensitive lookup by the key from app/hw/parser.js
    async function getOneByKey(key) {
        return await models.services.findOne({
            where: sequelize.where(sequelize.fn('lower', sequelize.col('name')), sequelize.fn('lower', key))
        });
    }
}
