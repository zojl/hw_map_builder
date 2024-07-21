module.exports = function(app) {
	app.bot.command('/r ', (ctx) => handleRouteGroup(ctx));
	app.bot.command('/p ', (ctx) => handleRouteGroup(ctx));
	app.bot.command('/w ', (ctx) => handleRouteGroup(ctx));
	app.bot.command('/route ', (ctx) => handleRouteGroup(ctx));
	app.bot.command('/path ', (ctx) => handleRouteGroup(ctx));
	app.bot.command('/way ', (ctx) => handleRouteGroup(ctx));

	app.bot.command('/wg ', (ctx) => handleRouteGroup(ctx));
	app.bot.command('/rg ', (ctx) => handleRouteGroup(ctx));
	app.bot.command('/pg ', (ctx) => handleRouteGroup(ctx));
	app.bot.command('/routegroup ', (ctx) => handleRouteGroup(ctx));
	app.bot.command('/pathgroup ', (ctx) => handleRouteGroup(ctx));
	app.bot.command('/waygroup ', (ctx) => handleRouteGroup(ctx));

	app.bot.command('/traverse', (ctx) => handleTraverse(ctx));
	app.bot.command('/trv', (ctx) => handleTraverse(ctx));
	app.bot.command('/tsp', (ctx) => handleTraverse(ctx));
	app.bot.command('/t', (ctx) => handleTraverse(ctx));
	
	async function handleRouteGroup(ctx) {
		const chat = await app.getChatFromMessage(ctx);
		if (chat === null) {
			return;
		}
		const subnet = await app.getSubnetFromChat(chat);
		let dates = app.getDates();

		const args = ctx.message.text.split(' ');
		if (args.length < 3) {
			ctx.reply('Укажи исходное устройство и одно или несколько конечных, например /route 00 AA BB CC DD, где 00 — исходное');
			return;
		}

		let routes = [];
		let usedDevices = [];
		const delimiter = chat.delimiter ? chat.delimiter : ' → ';
		const source = args[1].length == 1 ? "0" + args[1] : args[1];
		for (const targetNum in args) {
			if (targetNum < 2) {
				continue;
			}

			const target = args[targetNum].length == 1 ? "0" + args[targetNum] : args[targetNum];
			if (parseInt(target, 16) > 255) {
				routes.join(`❌ Некорректное устройство 📟${target}`);
				continue
			}

			if (usedDevices.includes(target.toUpperCase())) {
				continue;
			}

			const route = await app.dbUtil.pgroute.getRoute(source, target, dates.day, subnet.id);
			if (route !== null && route.length > 0) {
				const cost = route.length - 1;
				const routeReadable = route.join(delimiter);
				routes.push(`⚡${cost}: ${routeReadable}`);
				usedDevices.push(target.toUpperCase());
			} else {
				routes.push(`❌ Не могу построить путь от 📟${args[1]} до 📟${target}`);
			}
		}

		if (routes.length == 0) {
			ctx.reply('Мне не удалось построить путь ни до одного из перечисленных устройств.');
			return;
		}

		const deprecatedCommands = ['/wg', '/rg', '/pg', '/waygroup', '/routegroup', '/pathgroup'];
		if (deprecatedCommands.includes(args[0].toLowerCase())) {
			routes.push(`\n⚠Команды группового поиска (например, ${args[0]}) объявлены устаревшими и будут удалены в скором времени. Используйте базовые команды поиска пути (/p, /r, /w).`)
		}

		ctx.reply(routes.join("\n"));
	}

	async function handleTraverse(ctx) {
		const chat = await app.getChatFromMessage(ctx);
		if (chat === null) {
			return;
		}
		const subnet = await app.getSubnetFromChat(chat);

		let dates = app.getDates();
		let targetFromReply = null;

		const helpMsg = 'Укажи исходное устройство и диапазон поиска, например /traverse 55 40-7F, где 55 — исходное устройство';

		const args = ctx.message.text.split(' ');
		if (args.length < 3 || args.length > 4) {
			ctx.reply(helpMsg);
			return;
		}

		let minRange, maxRange;
		if (args.length === 3) {
			const subnetRaw = args[2];
			const minmaxRange = subnetRaw.split('-');
			if (minmaxRange.length != 2) {
				ctx.reply(helpMsg);
				return;
			}
			minRange = minmaxRange[0];
			maxRange = minmaxRange[1];
		} else {
			minRange = args[2];
			maxRange = args[3];
		}

		const sourceDevice = await app.repository.device.getOneByCode(args[1]);
		if (sourceDevice === null) {
			ctx.reply('Некорректное исходное устройство');
			return;
		}

		const minRangeDevice = await app.repository.device.getOneByCode(minRange);
		if (minRangeDevice === null) {
			ctx.reply('Некорректное начало диапазона');
			return;
		}

		const maxRangeDevice = await app.repository.device.getOneByCode(maxRange);
		if (maxRangeDevice === null) {
			ctx.reply('Некорректный конец диапазона');
			return;
		}

		const route = await app.dbUtil.pgroute.getTspIds(sourceDevice.id, minRangeDevice.code, maxRangeDevice.code, dates.day, subnet.id);
		if (route.length === 0) {
			ctx.reply('Не удалось построить маршрут');
			return;
		}

		let outRoute = 'Маршрут построен:\n';
		let totalCost = 0;
		const delimiter = chat.delimiter ? chat.delimiter : ' → ';
		for (const stepNum in route) {
			const step = route[stepNum];
			const readableStepNum = parseInt(stepNum) + 1;
			totalCost += step.length - 1;
			outRoute += `#${readableStepNum}. ⚡${step.length - 1}: ${step.join(delimiter)}` + '\n';
		}
		outRoute += `Итого путь требует ⚡${totalCost} мощности`;

		ctx.reply(outRoute);
	}
}