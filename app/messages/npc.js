module.exports = function(app) {
    app.bot.command('/npc', async (ctx) => {
        handleNpc(ctx)
    });

    const handleNpc = async (ctx) => {
        const chat = await app.getChatFromMessage(ctx);
        if (chat === null) {
            return;
        }
        const subnet = await app.getSubnetFromChat(chat);
        
        if (!chat.canSeeNpc) {
            ctx.reply('Эта команда не разрешена в этом чате.');
            return;
        }

        const args = ctx.message.text.split(' ');
        let sourceDevice = null;
        let dates = null;
        if (args.length >= 2) {
            const deviceCode = args[1];
            
            const sourceDeviceEntity = await app.repository.device.getOneByCode(deviceCode)
            if (sourceDeviceEntity == null) {
                ctx.reply('Такого устройства нет в базе: не встречалось ещё никому за время ивента.');
                return;
            }
            
            sourceDevice = sourceDeviceEntity;
            dates = app.getDates();
        }

        const npcLocations = await app.repository.npcLocation.findLastBySubnet(subnet.id);
        const oneDay = 24 * 60 * 60 * 1000; // milliseconds in a day
        
        let responseParts = {}
        const delimiter = chat.delimiter ? chat.delimiter : ' → ';
        for (const npcLocation of npcLocations) {
            const npc = await app.repository.npc.getOneById(npcLocation.npc);
            const device = await app.repository.device.getOneById(npcLocation.device);
            
            const today = new Date();
            const timeDiff = today - npcLocation.messageDate;
            if (timeDiff > oneDay) {
                continue;
            }

            const time = npcLocation.messageDate.toDateString() === today.toDateString()
                ? npcLocation.messageDate.toLocaleTimeString('ru-RU', { hour: 'numeric', minute: 'numeric' })
                : npcLocation.messageDate.toLocaleTimeString('ru-RU', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' })
            ;
            
            responseParts[npc.name] = `${npc.name}: 📟${device.code} (${time})`;
            
            if (sourceDevice !== null) {
                const route = await app.dbUtil.pgroute.getRoute(sourceDevice.code, device.code, dates.day, subnet.id)
                if (route === null || route.length === 0) {
                    responseParts[npc.name] = responseParts[npc.name] + `\nНе удаётся построить путь от ${sourceDevice.code} до ${device.code}\n`;
                } else {
                    const cost = route.length - 1;
                    responseParts[npc.name] = responseParts[npc.name] + `\n⚡${cost}: ${route.join(delimiter)}\n`;
                }
            }
        }
        
        let message = "Известные NPC:";
        for (const key of Object.keys(responseParts).sort()) {
            message += "\n" + responseParts[key];
        }
        
        ctx.reply(message);
    }
}
        
    
    