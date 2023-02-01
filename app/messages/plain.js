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
        let hitMessage = '';

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
            let unvisitedMessage = await app.dbUtil.unvisited.makeMessageByCodeAndDay(lastDevice, dates.day);
            ctx.reply('Спасибо!\n' + replies.join('\n') + unvisitedMessage);
            return;
        }

        if (hitMessage !== null) {
            sendHitToStatbot(hitMessage);
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
            let foundConnection = false;
            for (const line of lines) {
                if (foundConnection) {
                    if (line.startsWith('📟') && connections.length < 3) {
                        connections.push(line.substring(2));
                    }

                    continue;
                }

                if (line === '🌐Подключения:') {
                    foundConnection = true;
                }
            }

            const result = await app.dbUtil.pushToDB(device, connections, day);
            if (result) {
                console.log('added ' + device + ' linked to ' + connections.join(' '));
                replies.push('Устройство 📟' + device + ' отмечено как связанное с 📟' + connections.join(', 📟'));
            }
            lastDevice = device;

            if (process.env.IS_STATBOT_ENABLED === 'true') {
                try {
                    sendDevicesToStatBot(from, message, src.date);
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

    function sendDevicesToStatBot(userId, message, timestamp) {
        let apiDTO = extend({}, app.service.vHackApi.getDeviceDTO());
        apiDTO.ident = userId;
        apiDTO.timestamp = timestamp;

        let connectionsLine = null;
        const lines = message.split('\n')
        for (const index in lines) {
            const line = lines[index];
            const lineComponents = line.split(' ');

            if (line.startsWith('📟Устройство: ')) {
                apiDTO.device_info.device = parseInt(line.substring(line.length - 2), 16);
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
                const deviceNumber = index - connectionsLine;
                apiDTO.device_info.devices.push(parseInt(line.substring(line.length - 2), 16));
            }
        }

        app.service.vHackApi.sendDevice(apiDTO);
    }

    function sendHitToStatbot(message) {
        let apiDTO = {...app.service.vHackApi.getNpcDto()};
        apiDTO.ident = message.from_id;
        apiDTO.timestamp = message.date;

        if (!message.text.startsWith('Ты атаковал отслеживаемого пользователя')) {
            return;
        }

        const parts = message.text.split(' ');
        const bossName = parts[4] + ' ' + parts[5];
        const bossLocation = message.text.substring(message.text.length - 2);

        apiDTO.npc_info.device = parseInt(bossLocation, 16);
        apiDTO.npc_info.name = bossName;
        apiDTO.npc_info.npc = 4;

        app.service.vHackApi.sendNpc(apiDTO);
    }
};