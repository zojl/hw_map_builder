module.exports = function(sequelize, models) {
    return {
        getOneById,
        getOneByCode,
    }
    
    async function getOneById(id) {
        let subnet = await models.subnets.findOne({
            where: {
                id: id
            }
        });

        return subnet;
    }
    
    async function getOneByCode(code) {
        let subnet = await models.subnets.findOne({
            where: {
                code: code
            }
        });

        return subnet;
    }
}