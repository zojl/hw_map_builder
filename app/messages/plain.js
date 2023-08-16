module.exports = function (app) {
    const extend = require('util')._extend;

    app.bot.on(async ctx => {
        let dates = app.getDates();
        const msg = ctx.message;
        if (typeof (msg.fwd_messages) == 'undefined' || msg.fwd_messages.length == 0) {
            sendHelp(ctx);
            return;
        }

        const now = new Date();
        const updateTime = new Date(now.getFullYear(), now.getMonth(), dates.dayOfMonth, 18);
        const updateTimeStamp = updateTime.getTime() / 1000;

        let connectionMessages = [];
        let hitMessage = null;

        for (const src of msg.fwd_messages) {
            if (src.from_id !== parseInt(process.env.HW_BOT_ID)) {
                continue;
            }

            if (src.date < updateTimeStamp) {
                continue;
            }

            if (src.text.startsWith('📟Устройство:')) {
                connectionMessages.push(src);
                continue;
            }

            if (src.text.startsWith('Ты атаковал отслеживаемого пользователя')) {
                hitMessage = src;
            }
        }

        const {lastDevice, replies} = await handleConnectionMessages(connectionMessages, dates.day, msg.from_id);

        if (lastDevice !== null) {
            console.log(lastDevice);

            subnetCode = lastDevice.substr(0, 6);
            let subnet = await app.repository.subnet.getOneByCode(subnetCode);

            if(subnet === null) {
                ctx.reply('Спасибо!\n' + replies.join('\n') + 'Данное устройство находится в неизвестной подсети.');
                return
            }

            let unvisitedMessage = await app.dbUtil.unvisited.makeMessageByCodeAndDay(lastDevice, dates.day, subnet.id);
            ctx.reply('Спасибо!\n' + replies.join('\n') + unvisitedMessage);
            return;
        }

        if (hitMessage !== null && process.env.IS_VHINFO_ENABLED === 'true') {
            const reply = await handleHitMessage(hitMessage, dates.day, msg.from_id);
            ctx.reply(reply);
            return;
        }

        sendHelp(ctx);
    });

    function sendHelp(ctx) {
        if (ctx.message.from_id === ctx.message.peer_id) {
            ctx.reply('Пересылай сообщения от бота с 📟устройствами и вызывай /route xx yy для построения маршрутов.');
        }
    }

    async function handleConnectionMessages(connectionMessages, day, from) {
        let lastDevice = null;
        let replies = [];
        for (const src of connectionMessages) {
            const message = src.text;
            if (!message.startsWith('📟Устройство:')) {
                continue;
            }

            if (!message.includes('\n🌐Подключения:')) {
                continue;
            }

            const lines = message.split('\n');
            let device = lines[0].substring(lines[0].length - 8);
            let connections = [];
            let users = [];
            let foundConnection = false;
            let foundUsers = false;
            for (const line of lines) {
                if (foundConnection) {
                    if (line.startsWith('📟') && connections.length < 3) {
                        connections.push(line.substring(2,10));

                        continue;
                    }
                }

                if (foundUsers) {
                    if (
                        line.startsWith('🎯💣')
                        || line.startsWith('⚔💣')
                        || line.startsWith('⚖')
                        || line.startsWith('👀')
                    ) {
                        users.push(line);
                        continue;
                    }
                }

                if (line === '🌐Подключения:') {
                    foundConnection = true;
                }

                if (line === '📍Пользователи:') {
                    foundUsers = true;
                }
            }

            const result = await app.dbUtil.dbPusher.pushConnections(device, connections, day);
            if (result) {
                console.log('added ' + device + ' linked to ' + connections.join(' '));
                replies.push('Устройство 📟' + device + ' отмечено как связанное с 📟' + connections.join(', 📟'));
            }
            lastDevice = device;

            if (users.length > 0) {
                await app.dbUtil.dbPusher.pushUsers(users, device, src.date * 1000, from, false);
                const msgUserPlural = (users.length === 1) ? 'пользователя' : 'пользователей';
                replies.push(`Координаты ${msgUserPlural} ${users.join(', ')} сохранены`);
            }


            if (process.env.IS_VHINFO_ENABLED === 'true') {
                try {
                    sendDevicesToVhackInfo(from, message, src.date);
                } catch (error) {
                    app.sentry.captureException(error);
                    console.error(error);
                }
            }
        }

        return {
            lastDevice,
            replies
        }
    }

    async function handleHitMessage(hitMessage, day, vkUserId) {
        message = hitMessage.text;
        if (!message.startsWith('Ты атаковал отслеживаемого пользователя')) {
            return;
        }

        const lines = message.split("\n");
        const userLine = lines[0].split(' ');
        const userName = `🎯${userLine[userLine.length - 2]} ${userLine[userLine.length - 1]}`;

        const deviceLine = lines[lines.length - 1].split('📟');
        const device = deviceLine[deviceLine.length - 1];

        await app.dbUtil.dbPusher.pushUsers([userName], device, hitMessage.date * 1000, vkUserId, true);

        sendHitToVhackInfo(hitMessage);
        return `Координаты пользователя ${userName} сохранены`;
    }

    async function sendDevicesToVhackInfo(userId, message, timestamp) {
        let apiDTO = extend({}, app.service.vHackApi.getDeviceDTO());
        apiDTO.ident = userId;
        apiDTO.timestamp = timestamp;

        let connectionsLine = null;
        const lines = message.split('\n')
        for (const index in lines) {
            const line = lines[index];
            const lineComponents = line.split(' ');

            if (line.startsWith('📟Устройство: ')) {
                apiDTO.device_info.device = parseInt(line.substring(line.length - 8), 16);
            }

            if (line.startsWith('👥Союзники: ')) {
                apiDTO.device_info.allies = parseInt(lineComponents[1]);
            }

            if (line.startsWith('👥Пользователи: ')) {
                apiDTO.device_info.users = parseInt(lineComponents[1]);
            }

            if (line.startsWith('🎯💣')) {
                apiDTO.device_info.npcs.push({
                    "name": line.substring('🎯'.length),
                    "npc": 4, // # 0 - неизвестен, 1 - смотрит (на 00), 2 - босс (старый), 3 - торговец, 4 - отслеживаемый
                    "type": "nu"
                })
            }

            if (
                line.startsWith('⚖💣')
                || line.startsWith('⚖🔸')
                || line.startsWith('⚖🔺')
            ) {
                apiDTO.device_info.npcs.push({
                    "name": line.substring('⚖'.length),
                    "npc": 3,
                    "type": "nu"
                })
            }

            if (line.startsWith('⚔💣')) {
                apiDTO.device_info.npcs.push({
                    "name": line.substring('⚔'.length),
                    "npc": 2,
                    "type": "nu"
                })
            }

            if (line.startsWith('👀')) {
                apiDTO.device_info.npcs.push({
                    "name": line.substring('👀'.length),
                    "npc": 1,
                    "type": "nu"
                })
            }


            if (line === '🌐Подключения:') {
                connectionsLine = index;
            }

            if (
                connectionsLine !== null
                && index <= parseInt(connectionsLine) + 3
                && line.startsWith('📟')
            ) {
                apiDTO.device_info.devices.push(parseInt(line.match(/[A-F0-9]{8}/)[0], 16));
            }
        }

        app.service.vHackApi.sendDevice(apiDTO);
    }

    async function sendHitToVhackInfo(message) {
        let apiDTO = {...app.service.vHackApi.getNpcDto()};
        apiDTO.ident = message.from_id;
        apiDTO.timestamp = message.date;

        if (!message.text.startsWith('Ты атаковал отслеживаемого пользователя')) {
            return;
        }

        const parts = message.text.split(' ');
        let bossName = parts[4] + ' ' + parts[5];
        if (bossName.includes("\n")) {
            bossName = bossName.split("\n")[0];
        }
        const bossLocation = message.text.substring(message.text.length - 8);

        apiDTO.npc_info.device = parseInt(bossLocation, 16);
        apiDTO.npc_info.name = bossName;
        apiDTO.npc_info.npc = 4;

        app.service.vHackApi.sendNpc(apiDTO);
    }
};
