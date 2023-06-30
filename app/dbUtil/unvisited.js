module.exports = function(app) {
	return {
		makeMessageByCodeAndDay,
		getBySourceIdAndDay
	}

	async function makeMessageByCodeAndDay(deviceCode, day, subnetId) {
		const stats = await app.dbUtil.stats(day, subnetId);
		if (stats.sources >= 256) {
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
		const сonnections = await app.repository.connection.getAllBySourceDayAndSubnet(sourceId, day, subnetId);

		if (сonnections.length == 0) {
			return null;
		}

		let result = [];
		await recursiveSearch(8, 250, [sourceId], result, day, subnetId);
		result = sortByLength(result).slice(0, 5);
		return transformIdsToCodes(result);
	}

	async function recursiveSearch(depth, maxCount, trace, result, day, subnetId)
	{
		if (depth == 0 || result.length >= maxCount) {
			return;
		}

		const currentDevice = trace[trace.length - 1];
		const connections = await app.repository.connection.getAllBySourceDayAndSubnet(currentDevice, day, subnetId);
		if (connections.length == 0) {
			result.push(trace);
			return;
		}

		for (const connection of connections) {
			await recursiveSearch(depth - 1, maxCount, trace.concat([connection.target]), result, day, subnetId);
		}
	}

	function sortByLength(ids) {
		let pathsByLength = {};
		for (let path of ids) {
			const count = path.length;
			if (typeof(pathsByLength[count]) == 'undefined') {
				pathsByLength[count] = [];
			}
			pathsByLength[count].push(path);
		}

		const sortedKeys = Object.keys(pathsByLength).sort();
		let returnable = [];
		for (const key of sortedKeys) {
			returnable = returnable.concat(pathsByLength[key]);
		}

		return returnable;
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