module.exports = function(app) {
	const md5 = require('md5');
	const https = require('https');
	let lasfUpdateHash = null;

	return {
		updateMap
	}

	async function updateMap() {
		const url = process.env.STATBOT_HOST + '/api/v1/event/server-map/';

		const options = {'User-Agent': 'c0nd0rs_map_builder/1.0'};
		const request = https.get(url, options, (response) => {
			if (response.statusCode !== 200) {
				console.log(response);
				return;
			}

			let rawBody = '';
			response.on('data', (chunk) => { 
				rawBody += chunk; 
			});

			response.on('end', async () => {
				const responseText = rawBody.toString();

				if (!/^application\/json/.test(response.headers['content-type'])) {
                	console.error(responseText);
                	return;
				}

				const responseHash = md5(responseText);
				if (responseHash == lasfUpdateHash) {
					return;
				}

				const dates = app.getDates();
				let addedCounter = 0

				const map = JSON.parse(responseText);

				if (map.error === true) {
					console.log(map);
					return;
				}

				for (const mapConnection of map.data) {
					const source = mapConnection.from;
					for (const target of mapConnection.to) {
						const addResult = await app.dbUtil.pushToDB(source, target, dates.day);
						if (addResult) {
							addedCounter++;
						}
					}
				}

				console.info('Added ' + addedCounter + ' devices');
				lasfUpdateHash = responseHash;
            });
		});
	}
}