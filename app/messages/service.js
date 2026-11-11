module.exports = function(app) {
    app.bot.command('/services', async (ctx) => {
        await handleServices(ctx);
    });

    app.bot.command('/service', async (ctx) => {
        await handleServices(ctx);
    });

    app.bot.command('/svc', async (ctx) => {
        await handleServices(ctx);
    });

    const movesPerService = 3;

    const handleServices = async (ctx) => {
        const chat = await app.getChatFromMessage(ctx);
        if (chat === null) {
            return;
        }
        const subnet = await app.getSubnetFromChat(chat);
        if (subnet === null) {
            return;
        }

        if (!chat.canSeeNpc) {
            ctx.reply('Эта команда не разрешена в этом чате.');
            return;
        }

        const args = ctx.message.text.split(' ');
        let sourceDevice = null;
        if (args.length >= 2) {
            sourceDevice = await app.repository.device.getOneByCode(args[1]);
            if (sourceDevice === null) {
                ctx.reply('Такого устройства нет в базе: не встречалось ещё никому за время ивента.');
                return;
            }
        }

        const moves = await app.repository.serviceLocation.findRecentMovesBySubnet(subnet.id, movesPerService);
        if (moves.length === 0) {
            ctx.reply('В этой подсети ещё не встречалось ни одного сервиса.');
            return;
        }

        const serviceIds = [...new Set(moves.map((move) => move.service))];
        const deviceIds = [...new Set(moves.map((move) => move.device))];
        const services = await app.repository.service.getAllByIds(serviceIds);
        const deviceCodes = await app.repository.device.getCodesByIds(deviceIds);

        const movesByService = {};
        for (const move of moves) {
            if (typeof(movesByService[move.service]) === 'undefined') {
                movesByService[move.service] = [];
            }
            movesByService[move.service].push(move);
        }

        const day = app.getDates().day;
        const delimiter = chat.delimiter ? chat.delimiter : ' → ';
        const now = new Date();
        const parts = [];

        for (const service of services) {
            const serviceMoves = movesByService[service.id];
            const [last, ...previous] = serviceMoves;
            const lastCode = deviceCodes[last.device];

            // The latest observation as the game showed it (type and team may change)
            let part = `${last.raw || service.name}: 📟${lastCode} (${formatAge(now, new Date(last.messageDate))})`;

            if (previous.length > 0) {
                const previousReadable = previous
                    .map((move) => `📟${deviceCodes[move.device]} (${formatAge(now, new Date(move.messageDate))})`)
                    .join(', ');
                part += `\nранее: ${previousReadable}`;
            }

            if (sourceDevice !== null) {
                const route = await app.dbUtil.pgroute.getRoute(sourceDevice.code, lastCode, day, subnet.id);
                if (route === null || route.length === 0) {
                    part += `\nНе удаётся построить путь от ${sourceDevice.code} до ${lastCode}`;
                } else {
                    part += `\n⚡${route.length - 1}: ${route.join(delimiter)}`;
                }
            }

            parts.push({name: service.name, text: part});
        }

        parts.sort((a, b) => a.name.localeCompare(b.name));
        const separator = sourceDevice !== null || parts.some((part) => part.text.includes('\n')) ? '\n\n' : '\n';
        ctx.reply('Известные сервисы:\n' + parts.map((part) => part.text).join(separator));
    }

    function formatAge(now, date) {
        const minutes = Math.max(0, Math.floor((now - date) / 60000));
        if (minutes < 1) {
            return 'только что';
        }

        if (minutes < 60) {
            return `${minutes} мин. назад`;
        }

        if (minutes < 24 * 60) {
            const hours = Math.floor(minutes / 60);
            const restMinutes = minutes % 60;
            return restMinutes === 0
                ? `${hours} ч. назад`
                : `${hours} ч. ${restMinutes} мин. назад`;
        }

        return date.toLocaleString('ru-RU', {day: 'numeric', month: 'numeric', hour: 'numeric', minute: 'numeric'});
    }
}
