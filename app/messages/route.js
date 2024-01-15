module.exports = function(app) {
	app.bot.command('/r ', (ctx) => {
		handleCommand(ctx);
	})

	app.bot.command('/p ', (ctx) => {
		handleCommand(ctx);
	})

	app.bot.command('/w ', (ctx) => {
		handleCommand(ctx);
	})

	app.bot.command('/route ', (ctx) => {
		handleCommand(ctx);
	})


	app.bot.command('/path ', (ctx) => {
		handleCommand(ctx);
	})

	app.bot.command('/way ', (ctx) => {
		handleCommand(ctx);
	})

	app.bot.command('/wg ', (ctx) => {
		handleRouteGroup(ctx);
	})

	app.bot.command('/rg ', (ctx) => {
		handleRouteGroup(ctx);
	})

	app.bot.command('/pg ', (ctx) => {
		handleRouteGroup(ctx);
	})

	app.bot.command('/routegroup ', (ctx) => {
		handleRouteGroup(ctx);
	})

	app.bot.command('/pathgroup ', (ctx) => {
		handleRouteGroup(ctx);
	})

	app.bot.command('/waygroup ', (ctx) => {
		handleRouteGroup(ctx);
	})

	app.bot.command('/traverse', (ctx) => {
		handleTraverse(ctx);
	})

	app.bot.command('/trv', (ctx) => {
		handleTraverse(ctx);
	})

	app.bot.command('/tsp', (ctx) => {
		handleTraverse(ctx);
	})

	app.bot.command('/t', (ctx) => {
		handleTraverse(ctx);
	})

	async function handleCommand(ctx) {
		const chat = await app.getChatFromMessage(ctx);
		if (chat === null) {
			return;
		}
		const subnet = await app.getSubnetFromChat(chat);

		let dates = app.getDates();
        let targetFromReply = null;

        if (
            typeof(ctx.message.reply_message) !== 'undefined'
            && typeof(ctx.message.reply_message.fwd_messages) === 'object'
            && Array.isArray(ctx.message.reply_message.fwd_messages)
            && ctx.message.reply_message.fwd_messages.length === 1
            && ctx.message.reply_message.fwd_messages[0].from_id === parseInt(process.env.HW_BOT_ID)
            && ctx.message.reply_message.fwd_messages[0].text.startsWith('Ты атаковал отслеживаемого пользователя')
        ) {
            const msgText = ctx.message.reply_message.fwd_messages[0].text;
            targetFromReply = msgText.substring(msgText.length - 2);
        }

        const args = ctx.message.text.split(' ');
		if (
            args.length <= 2
            && !(
                args.length === 2
                && targetFromReply !== null
            )
        ) {
			ctx.reply('Укажи исходное и конечное устройство, например /route 00 FF');
			return;
		}

        const target = targetFromReply !== null ? targetFromReply : args[2];
		const result = await app.dbUtil.pgroute.getRoute(args[1], target, dates.day, subnet.id);
		console.log([
			ctx.message.from_id,
			result
		]);
		if (result === null || result.length === 0) {
			ctx.reply(`❌ У меня пока недостаточно данных о сегодняшних устройствах, чтобы построить маршрут от 📟${args[1]} до 📟${target}.`);
			return;
		}

		const cost = result.length - 1;
		const delimiter = chat.delimiter ? chat.delimiter : ' → ';
		const route = result.join(delimiter);
		ctx.reply(`⚡${cost}: ${route}`);
	}

	async function handleRouteGroup(ctx) {
		const chat = await app.getChatFromMessage(ctx);
		if (chat === null) {
			return;
		}
		const subnet = await app.getSubnetFromChat(chat);
		let dates = app.getDates();

		const args = ctx.message.text.split(' ');
		if (args.length < 4) {
			ctx.reply('Укажи исходное устройство и список конечных, например /route 00 AA BB CC DD, где 00 — исходное');
			return;
		}

		let routes = [];
		let usedDevices = [];
		const delimiter = chat.delimiter ? chat.delimiter : ' → ';
		for (const targetNum in args) {
			if (targetNum < 2) {
				continue;
			}

			const target = args[targetNum];
			if (parseInt(target, 16) > 255) {
				continue;
			}

			if (usedDevices.includes(target.toUpperCase())) {
				continue;
			}

			const route = await app.dbUtil.pgroute.getRoute(args[1], target, dates.day, subnet.id);
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

		ctx.reply("Известные пути до указанных устройств:\n" + routes.join("\n"));
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