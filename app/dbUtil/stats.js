module.exports = function(sequelize, models) {
	const getStats = async function (day) {
		const countSources = await models.connections.count({
			distinct: 'source', 
			col: 'source',
			where: {
				day: day
			}
		});
		const countTargets = await models.connections.count({
			distinct: 'target', 
			col: 'target',
			where: {
				day: day
			}
		});

		return {
			"sources": countSources,
			"targets": countTargets
		}
	}

	return getStats;
}