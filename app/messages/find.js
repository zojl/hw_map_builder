module.exports = function(app) {
    const devicesCount = 256;
    const linkToDeviceCount = 3;
    app.bot.command('/find', async (ctx) => {
        handleFind(ctx)
    });

    app.bot.command('/f ', async (ctx) => {
        handleFind(ctx)
    });
    
    const handleFind = async (ctx) => {
        const chat = await app.getChatFromMessage(ctx);
        if (chat === null) {
            return;
        }
        const subnet = await app.getSubnetFromChat(chat);
        if (subnet === null) {
            return;
        }

        const args = ctx.message.text.match(/[a-f0-9]{2}/gi);
        if (
            args.length < 2
            ) {
            ctx.reply('Укажи устройство и целевые связи, например /find 00 01 02 03');
            return;
        }

        const device = await app.repository.device.getOneByCode(args[0]);
        if (device === null) {
            ctx.reply('Я не знаю такого устройства');
            return;
        }

        let dates = app.getDates();
        const connections = await app.repository.connection.getAllBySourceDayAndSubnet(device.id, dates.day, subnet.id);
        if (connections.length === 0) {
            ctx.reply('Этого устройства нет на сегодняшней карте. Перешли сообщение с его связями, если посещал его.');
            return;
        }

        let connectedCodes = [];
        let routes = [];
        const targets = args.slice(1);
        for (const connection of connections) {
            connectedDevice = await app.repository.device.getOneById(connection.target);
            if (connectedDevice.code === args[1].toUpperCase()) {
                continue;
            }
        
            let usedDevices = [];
            for (const target of targets) {
                if (parseInt(target, 16) > 255) {
                    continue;
                }

                if (usedDevices.includes(target.toUpperCase())) {
                    continue;
                }
                
                console.log([connectedDevice.code, target])
                const route = await app.dbUtil.pgroute.getRoute(connectedDevice.code, target, dates.day, subnet.id);
                if (route !== null) {
                    const cost = route.length;
                    const delimiter = chat.delimiter ? chat.delimiter : ' → ';
                    const routeReadable = device.code + delimiter + route.join(delimiter);
                    routes.push(`⚡${cost}: ${routeReadable}`);
                    usedDevices.push(target.toUpperCase());
                }
            }
        }
        
        if (routes.length == 0) {
            ctx.reply('Мне не удалось построить путь ни до одного из перечисленных устройств.');
            return;
        }

        ctx.reply("Известные пути для указанных устройств:\n" + routes.join("\n"));
    }

    const handleReverseLinks = async (ctx) => {
        const subnet = await app.getSubnetFromMessage(ctx);
        if (subnet === null) {
            return;
        }

        const args = ctx.message.text.split(' ');
        if (
            args.length < 2 
            ) {
            ctx.reply('Укажи устройство, связи с которым хочешь увидеть, например /reverselinks 00');
            return;
        }

        const device = await app.repository.device.getOneByCode(args[1]);
        if (device === null) {
            ctx.reply('Я не знаю такого устройства');
            return;
        }

        let dates = app.getDates();
        const connections = await app.repository.connection.getAllByTargetDayAndSubnet(device.id, dates.day, subnet.id);
        if (connections.length === 0) {
            ctx.reply('На карте пока нет устройств, связанных с этим.');
            return;
        }

        let connectedCodes = [];
        for (const connection of connections) {
            connectedDevice = await app.repository.device.getOneById(connection.source);
            connectedCodes.push(connectedDevice.code);
        }

        const connectedReadable = connectedCodes.join(', 📟'); 
        ctx.reply(`На устройство 📟${device.code} можно перейти с 📟${connectedReadable}.`);
    }


}