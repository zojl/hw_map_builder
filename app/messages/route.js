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
		const result = await app.dbUtil.dijkstra.getRoute(args[1], target, dates.day, subnet.id);
		console.log([
			ctx.message.from_id,
			result
		]);
		if (result === null) {
			ctx.reply('У меня пока недостаточно данных о сегодняшних устройствах, чтобы построить такой маршрут.');
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

			const route = await app.dbUtil.dijkstra.getRoute(args[1], target, dates.day, subnet.id);
			if (route !== null) {
				const cost = route.length - 1;
				const routeReadable = route.join(delimiter);
				routes.push(`⚡${cost}: ${routeReadable}`);
				usedDevices.push(target.toUpperCase());
			}
		}

		if (routes.length == 0) {
			ctx.reply('Мне не удалось построить путь ни до одного из перечисленных устройств.');
			return;
		}

		ctx.reply("Известные пути до указанных устройств:\n" + routes.join("\n"));
	}
}