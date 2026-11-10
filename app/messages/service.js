module.exports = function(app) {
    app.bot.command('/service', async (ctx) => {
        await handleService(ctx);
    });

    app.bot.command('/svc', async (ctx) => {
        await handleService(ctx);
    });

    const maxResults = 20;

    const handleService = async (ctx) => {
        const chat = await app.getChatFromMessage(ctx);
        if (chat === null) {
            return;
        }
        const subnet = await app.getSubnetFromChat(chat);
        if (subnet === null) {
            return;
        }

        const namePart = ctx.message.text.split(' ').slice(1).join(' ').trim();
        if (namePart === '') {
            ctx.reply('Укажи часть названия сервиса, например /service pasta');
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

        const today = app.getDates().day;
        const lines = [];
        for (const location of locations) {
            const device = await app.repository.device.getOneById(location.device);
            const time = location.messageDate.toLocaleTimeString('ru-RU', {month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric'});
            const staleMark = location.day === today ? '' : ' (не сегодня)';
            lines.push(`${serviceNames[location.service]}: 📟${device.code} — ${time}${staleMark}`);
        }

        lines.sort();
        const shown = lines.slice(0, maxResults);
        const more = lines.length > maxResults ? `\n…и ещё ${lines.length - maxResults}` : '';
        ctx.reply('Последние известные места сервисов:\n' + shown.join('\n') + more);
    }
}
