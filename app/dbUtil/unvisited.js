module.exports = function(app) {
	return {
		makeMessageByCodeAndDay,
		getBySourceIdAndDay
	}

	async function makeMessageByCodeAndDay(deviceCode, day, subnetId) {
		const stats = await app.dbUtil.stats(day, subnetId);
		const subnet = await app.repository.subnet.getOneById(subnetId);
		if (subnet === null) {
			return '\n Ошибка определения подсети';
		}

		const subnetLimit = subnet.length;

		if (stats.sources >= subnetLimit) {
			return '\nВсе 📟устройства уже исследованы!'
		}

		const device = await app.repository.device.getOneByCode(deviceCode);
		const unvisited = await getBySourceIdAndDay(device.id, day, subnetId);
		if (unvisited.length == 0) {
			return '\nНет 📟устройств для исследования поблизости.';
		} 

		let unvisitedMessage = '\nНеисследованные 📟устройства поблизости:';
		for (let codes of unvisited) {
			const cost = codes.length - 1;
			const route = codes.join(' → ');
			unvisitedMessage += `\n⚡${cost}: ${route}`;
		}

		return unvisitedMessage;
	}

	async function getBySourceIdAndDay(sourceId, day, subnetId) {
		const unconnected = await app.repository.device.findAllUnconnected(day, subnetId)
		const subnet = await app.repository.subnet.getOneById(subnetId);
		if (unconnected.length === 0 || unconnected.length === subnet.length) {
			return null;
		}

		const pathsLimit = 7;
		const pathsToShow = await getShortestPaths(unconnected, sourceId, day, subnetId, pathsLimit);
		return transformIdsToCodes(pathsToShow);
	}

	async function getShortestPaths(unconnected, sourceId, day, subnetId, pathsLimit)
	{
		let pathsToUnconnecteds = {};
		for (const target of unconnected) {
			const path = await app.dbUtil.dijkstra.getRouteIds(sourceId, target.id, day, subnetId);
			if (path === null || path.length === 0) {
				continue;
			}

			if (typeof(pathsToUnconnecteds[path.length]) === 'undefined') {
				pathsToUnconnecteds[path.length] = [];
			}

			pathsToUnconnecteds[path.length].push(path);
		}

		let pathsToShow = []
		for (const pathLength of Object.keys(pathsToUnconnecteds)) {
			for (const path of pathsToUnconnecteds[pathLength]) {
				pathsToShow.push(path);
				if (pathsToShow.length >= pathsLimit) {
					return pathsToShow
				}
			}
		}

		return pathsToShow;
	}

	async function transformIdsToCodes(ids) {
		let allIds = [];
		for (const line of ids) {
			for (const id of line) {
				if (!allIds.includes(id)) {
					allIds = allIds.concat(id);
				}
			}
		}

		let allCodes = await app.repository.device.getCodesByIds(allIds);

		let codeLines = [];

		for (const line of ids) {
			let newLine = [];
			for (const id of line) {
				newLine.push(allCodes[id]);
			}
			codeLines.push(newLine);
		}

		return codeLines;
	}
}