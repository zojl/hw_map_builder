module.exports = function(app) {
	const md5 = require('md5');
	const https = require('https');
	let lasfUpdateHash = null;
	let timerId = null;

	const url = process.env.STATBOT_HOST + '/server/map/';
	const options = {'User-Agent': 'c0nd0rs_map_builder/1.0', 'Authorization': process.env.STATBOT_AUTH_TOKEN};

	return {
		updateMap,
		initImport,
		stopImport
	}

	async function updateMap() {
		const request = https.get(url, options, (response) => {
			if (response.statusCode !== 200) {
				console.log(response);
				return;
			}

			let rawBody = '';
			response.on('data', (chunk) => { 
				rawBody += chunk; 
			});

            response.on('error', (e) => {
                app.sentry.captureException(e);
            })

			response.on('end', async () => {
				const responseText = rawBody.toString();

				if (!/^application\/json/.test(response.headers['content-type'])) {
                	console.error(responseText);
                	return;
				}

				const responseHash = md5(responseText);
				if (responseHash === lasfUpdateHash) {
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
					let connectionsTo = [];
					for (target of mapConnection.to) {
						connectionsTo.push(target.match(/[a-fA-F0-9]{8}/)[0]);
					}
					const addResult = await app.dbUtil.dbPusher.pushConnections(
						mapConnection.from.match(/[a-fA-F0-9]{8}/)[0],
						connectionsTo,
						dates.day
					);
					if (addResult) {
						addedCounter++;
					}
				}

				console.info('Added ' + addedCounter + ' devices');
				lasfUpdateHash = responseHash;
            });
		});
	}

	function initImport(timeout) {
		stopImport();

		updateMap();
		timerdId = setInterval(function(){updateMap();}, timeout);
	}

	function stopImport() {
		if (timerId !== null) {
			clearInterval(timerId);
			timerId = null;	
		}
	}
}