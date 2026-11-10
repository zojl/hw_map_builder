module.exports = function(app) {
    app.bot.command('/services', async (ctx) => {
        await handleService(ctx);
    });

    app.bot.command('/service', async (ctx) => {
        await handleService(ctx);
    });

    app.bot.command('/svc', async (ctx) => {
        await handleService(ctx);
    });

    const maxResults = 50;

    const handleService = async (ctx) => {
        const chat = await app.getChatFromMessage(ctx);
        if (chat === null) {
            return;
        }
        const subnet = await app.getSubnetFromChat(chat);
        if (subnet === null) {
            return;
        }

        const today = app.getDates().day;
        const namePart = ctx.message.text.split(' ').slice(1).join(' ').trim();

        if (namePart === '') {
            await replyAllToday(ctx, subnet, today);
            return;
        }

        const services = await app.repository.service.getAllByNamePart(namePart);
        if (services.length === 0) {
            ctx.reply('Я не знаю сервисов с таким названием.');
            return;
        }

        const serviceNames = {};
        for (const service of services) {
            serviceNames[service.id] = service.name;
        }

        const locations = await app.repository.serviceLocation.findLastByServicesAndSubnet(Object.keys(serviceNames), subnet.id);
        if (locations.length === 0) {
            ctx.reply('Сервисы с таким названием в этой подсети ещё не встречались.');
            return;
        }

        const lines = await formatLocations(locations, serviceNames, today);
        ctx.reply('Последние известные места сервисов:\n' + lines);
    }

    async function replyAllToday(ctx, subnet, today) {
        const locations = await app.repository.serviceLocation.findLastBySubnetAndDay(subnet.id, today);
        if (locations.length === 0) {
            ctx.reply('Сегодня в этой подсети ещё не встречалось ни одного сервиса. Для поиска по названию: /service pasta');
            return;
        }

        const serviceNames = {};
        for (const location of locations) {
            const service = await app.repository.service.getOneById(location.service);
            serviceNames[location.service] = service.name;
        }

        const lines = await formatLocations(locations, serviceNames, today);
        ctx.reply('Сервисы, замеченные сегодня:\n' + lines);
    }

    async function formatLocations(locations, serviceNames, today) {
        const lines = [];
        for (const location of locations) {
            const device = await app.repository.device.getOneById(location.device);
            const time = location.messageDate.toLocaleTimeString('ru-RU', {month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric'});
            const staleMark = location.day === today ? '' : ' (не сегодня)';
            lines.push(`${serviceNames[location.service]}: 📟${device.code} — ${time}${staleMark}`);
        }

        lines.sort();
        const more = lines.length > maxResults ? `\n…и ещё ${lines.length - maxResults}` : '';
        return lines.slice(0, maxResults).join('\n') + more;
    }
}
