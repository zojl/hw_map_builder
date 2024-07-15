module.exports = function(sequelize, models) {
	const getStats = async function (day, subnetId, rangeStart = null, rangeEnd = null) {
		let sourcesRequest = {
			distinct: 'source', 
			col: 'source',
			where: {
				day: day,
				subnet: subnetId,
			}
		}
		if (rangeStart !== null && rangeEnd !== null) {
			sourcesRequest.where = sequelize.literal(`day = ${day} AND subnet = ${subnetId} AND EXISTS(SELECT 1 FROM devices WHERE devices.id = connections.source AND hex2dec(code) >= ${rangeStart} AND hex2dec(code) <= ${rangeEnd})`)
		}
		const countSources = await models.connections.count(sourcesRequest);

		let targetsRequest = {
			distinct: 'target',
			col: 'target',
			where: {
				day: day,
				subnet: subnetId,
			}
		}

		if (rangeStart !== null && rangeEnd !== null) {
			targetsRequest.where = sequelize.literal(`day = ${day} AND subnet = ${subnetId} AND EXISTS(SELECT 1 FROM devices WHERE devices.id = connections.target AND hex2dec(code) >= ${rangeStart} AND hex2dec(code) <= ${rangeEnd})`)
		}
		const countTargets = await models.connections.count(targetsRequest);

		return {
			"sources": countSources,
			"targets": countTargets,
		}
	}

	return getStats;
}