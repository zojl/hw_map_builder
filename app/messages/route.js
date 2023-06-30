module.exports = function(app) {
	app.bot.command('/r', (ctx) => {
		handleCommand(ctx);
	})

	app.bot.command('/p', (ctx) => {
		handleCommand(ctx);
	})

	app.bot.command('/w', (ctx) => {
		handleCommand(ctx);
	})

	app.bot.command('/route', (ctx) => {
		handleCommand(ctx);
	})


	app.bot.command('/path', (ctx) => {
		handleCommand(ctx);
	})

	app.bot.command('/way', (ctx) => {
		handleCommand(ctx);
	})

	async function handleCommand(ctx) {
		const chat = await app.repository.chat.getOneByPeerId(ctx.message.peer_id)
		if (chat === null) {
			ctx.reply('Эта команда работает только в чатах, которым назначены подсети в боте.');
			return;
		}

		const subnet = await app.repository.subnet.getOneById(chat.subnet);
		if (subnet === null) {
			ctx.reply('Ошибка подбора подсети, обратитесь в техподдержку');
			return;
		}

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
        const result = await app.dbUtil.dijkstra(args[1], target, dates.day, subnet.id);
		console.log(result);
		if (result === null) {
			ctx.reply('У меня пока недостаточно данных о сегодняшних устройствах, чтобы построить такой маршрут.');
			return;
		}

		const cost = result.length - 1;
		const route = result.join(' → ');
		ctx.reply(`⚡${cost}: ${route}`);
	}
}