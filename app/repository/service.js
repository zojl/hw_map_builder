module.exports = function(sequelize, models) {
    return {
        getOneById,
        getAllByNamePart,
    }

    async function getOneById(serviceId) {
        return await models.services.findOne({
            where: {
                id: serviceId
            }
        });
    }

    async function getAllByNamePart(namePart) {
        const escaped = namePart.replace(/[\\%_]/g, '\\$&');

        return await models.services.findAll({
            where: {
                name: {
                    [sequelize.Op.iLike]: `%${escaped}%`
                }
            }
        });
    }
}
