module.exports = function(app) {
    const devicesCount = 256;
    const linkToDeviceCount = 3;
    app.bot.command('/links', async (ctx) => {
        handleLinks(ctx)
    });

    app.bot.command('/l ', async (ctx) => {
        handleLinks(ctx)
    });
    
    app.bot.command('/reverselinks', async (ctx) => {
        handleReverseLinks(ctx)
    });

    app.bot.command('/rl ', async (ctx) => {
        handleReverseLinks(ctx)
    });
    
    const handleLinks = async (ctx) => {
        const subnet = await app.getSubnetFromMessage(ctx);

        const args = ctx.message.text.split(' ');
        if (
            args.length < 2 
        ) {
            ctx.reply('Укажи устройство, связи которого хочешь увидеть, например /links 00');
            return;
        }
        
        const device = await app.repository.device.getOneByCode(args[1]);
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
        for (const connection of connections) {
            connectedDevice = await app.repository.device.getOneById(connection.target);
            connectedCodes.push(connectedDevice.code);
        }
        
        const connectedReadable = connectedCodes.join(', 📟'); 
        ctx.reply(`Устройство 📟${device.code} связано с устройствами 📟${connectedReadable}.`);
    }
    
    const handleReverseLinks = async (ctx) => {
        const subnet = await app.getSubnetFromMessage(ctx);

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