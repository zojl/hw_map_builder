module.exports = function(app) {
	return {
		getByConnectionsAndDay,
		getBySourceIdAndDay
	}

	async function getByConnectionsAndDay(deviceConnections, day) {
		const connectedTargetIds = deviceConnections.map(connection => connection.target);
		const connectionsFound = await app.repository.connection.getAllBySourceAndDay(connectedTargetIds, day);

		let connectionsFoundIds = [];
		for (const connectionFound of connectionsFound) {
			if (!connectionsFoundIds.includes(connectionFound.source)) {
				connectionsFoundIds.push(connectionFound.source);
			}
		}

		let notFoundConnectionsIds = []
		for (const id of connectedTargetIds) {
			if (!connectionsFoundIds.includes(id)) {
				notFoundConnectionsIds.push(id);
			}
		}

		let notFoundDevices = await app.repository.device.getAllByIds(notFoundConnectionsIds);

		if (notFoundDevices == null || notFoundDevices.length == 0) {
			return {
				"all": connectionsFound,
				"notFound": []
			} 
		}

		let notFoundCodes = [];
		for (const device of notFoundDevices) {
			notFoundCodes.push(device.code);
		}

		return {
			"all": connectionsFound,
			"notFound": notFoundCodes
		}

	}

	async function getBySourceIdAndDay(sourceId, day) {
		const сonnections = await app.repository.connection.getAllBySourceAndDay(sourceId, day);

		if (сonnections.length == 0) {
			return null;
		}

		return getByConnectionsAndDay(сonnections, day);
	}
}