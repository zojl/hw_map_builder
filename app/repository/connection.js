module.exports = function(sequelize, models) {
    return {
        getAllByTargetDayAndSubnet,
        getAllBySourceDayAndSubnet,
        getOneBySourceTargetAndDay,
        getAllByDayAndSubnet,
    }

    async function getAllBySourceDayAndSubnet(sourceId, day, subnetId) {
        let connectionEntities = await models.connections.findAll({
            where: {
                source: sourceId,
                day: day,
                subnet: subnetId
            }
        });

        if (connectionEntities == null || connectionEntities.length == 0) {
            return [];
        }

        return connectionEntities;
    }

    async function getAllByTargetDayAndSubnet(targetId, day, subnetId) {
        let connectionEntities = await models.connections.findAll({
            where: {
                target: targetId,
                day: day,
                subnet: subnetId
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

    async function getAllByDayAndSubnet(day, subnetId) {
        let connectionEntities = await models.connections.findAll({
            where: {
                day: day,
                subnet: subnetId
            }
        });

        if (connectionEntities == null || connectionEntities.length == 0) {
            return [];
        }

        return connectionEntities;
    }
}