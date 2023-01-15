module.exports = function(sequelize, models) {
    return {
        getAllByTargetAndDay,
        getAllBySourceAndDay,
        getOneBySourceTargetAndDay
    }

    async function getAllBySourceAndDay(sourceId, day) {
        let connectionEntities = await models.connections.findAll({
            where: {
                source: sourceId,
                day: day
            }
        });

        if (connectionEntities == null || connectionEntities.length == 0) {
            return [];
        }

        return connectionEntities;
    }

    async function getAllByTargetAndDay(targetId, day) {
        let connectionEntities = await models.connections.findAll({
            where: {
                target: targetId,
                day: day
            }
        });

        if (connectionEntities == null || connectionEntities.length == 0) {
            return [];
        }

        return connectionEntities;
    }

    async function getOneBySourceTargetAndDay(sourceId, targetId, day) {
        let connectionEntity = await models.connections.findOne({
            where: {
                source: sourceId,
                target: targetId,
                day: day
            }
        });


        if (connectionEntity == null) {
            return [];
        }

        return connectionEntity;
    }
}