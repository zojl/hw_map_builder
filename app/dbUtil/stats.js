module.exports = function(sequelize, models) {
	const getStats = async function (day, subnetId) {
		const countSources = await models.connections.count({
			distinct: 'source', 
			col: 'source',
			where: {
				day: day,
				subnet: subnetId,
			}
		});
		const countTargets = await models.connections.count({
			distinct: 'target', 
			col: 'target',
			where: {
				day: day,
				subnet: subnetId,
			}
		});

		const countConnections = await models.connections.count({
			col: 'connections',
			where: {
				day: day,
				subnet: subnetId,
			}
		});

		return {
			"sources": countSources,
			"targets": countTargets,
			"connections": countConnections,
		}
	}

	return getStats;
}