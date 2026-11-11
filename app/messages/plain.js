const parser = require('../hw/parser.js');

module.exports = function (app) {
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
        let announceMessage = null;

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
                continue;
            }

            if (
                src.text.startsWith('📍Подозрительные пользователи были замечены на устройствах:')
                || src.text.startsWith('🌐Новые цели для атаки в сети')
            ) {
                announceMessage = src;
            }
        }

        const chat = await app.repository.chat.getOneByPeerId(ctx.message.peer_id)
        const chatPeerId = chat === null || typeof(chat.peerId) == 'undefined' ? null : chat.peerId;
        const silentMode = ctx.message.text.startsWith('/s');
        const {lastDevice, replies} = await handleConnectionMessages(connectionMessages, dates.day, msg.from_id, chatPeerId, silentMode);
        let hasHandledMessages = false;

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
            hasHandledMessages = true;
        }

        if (hitMessage !== null) {
            const reply = await handleHitMessage(hitMessage, dates.day, msg.from_id, chatPeerId, silentMode);
            ctx.reply(reply);
            hasHandledMessages = true;
        }

        if (announceMessage !== null) {
            const reply = await handleAnnounceMessage(announceMessage, dates.day, msg.from_id, chatPeerId);
            ctx.reply(reply);
            hasHandledMessages = true;
        }

        if (!hasHandledMessages) {
            sendHelp(ctx);
        }
    });

    function sendHelp(ctx) {
        if (ctx.message.from_id === ctx.message.peer_id) {
            ctx.reply('Пересылай сообщения от бота с 📟устройствами и вызывай /route xx yy для построения маршрутов.');
        }
    }

    async function handleConnectionMessages(connectionMessages, day, from, chatPeerId, silentMode) {
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
            let services = [];
            let currentSection = null;
            for (const line of lines) {
                if (line === '') {
                    currentSection = null;
                    continue;
                }

                const header = getSectionHeader(line);
                if (header) {
                    currentSection = header;
                    continue;
                }

                if (currentSection === 'services') {
                    const service = parser.parseService(line);
                    if (service !== null) {
                        services.push(service);
                    }
                    continue;
                }

                if (currentSection === 'connections' && line.startsWith('📟')) {
                    connections.push(line.substring(2, 10));
                    continue;
                }

                if (currentSection === 'users') {
                    const npc = parser.parseNpc(line);
                    if (npc !== null) {
                        users.push(npc);
                    }
                    continue;
                }
            }

            const result = await app.dbUtil.dbPusher.pushConnections(device, connections, day);
            if (result) {
                console.log('added ' + device + ' linked to ' + connections.join(' '));
                replies.push('Устройство 📟' + device + ' отмечено как связанное с 📟' + connections.join(', 📟'));
            }
            lastDevice = device;

            const messageDate = new Date(src.date * 1000);

            if (users.length > 0) {
                const moves = await app.dbUtil.dbPusher.pushNpcs(users, device, messageDate, from, false, true);
                await app.service.notifier.notifyMoves(chatPeerId, moves, device, messageDate.getTime());
                const msgUserPlural = (users.length === 1) ? 'пользователя' : 'пользователей';
                replies.push(`Координаты ${msgUserPlural} ${users.map((npc) => npc.raw).join(', ')} сохранены`);
            }

            if (services.length > 0) {
                const moves = await app.dbUtil.dbPusher.pushServices(services, device, day, messageDate, from, true);
                if (moves !== null) {
                    await app.service.notifier.notifyMoves(chatPeerId, moves, device, messageDate.getTime());
                    const msgServicePlural = (services.length === 1) ? 'Сервис' : 'Сервисы';
                    replies.push(`${msgServicePlural} ${services.map((service) => service.raw).join(', ')} на 📟${device} сохранены`);
                }
            }

            if (
                !silentMode
                && process.env.IS_VHINFO_ENABLED === 'true'
            ) {
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

    async function handleHitMessage(hitMessage, day, vkUserId, chatPeerId, silentMode) {
        message = hitMessage.text;
        if (!message.startsWith('Ты атаковал отслеживаемого пользователя')) {
            return;
        }

        const lines = message.split("\n");
        const userLine = lines[0].split(' ');
        const userName = `🎯${userLine[userLine.length - 2]} ${userLine[userLine.length - 1]}`;
        const npc = parser.parseNpc(userName);
        if (npc === null) {
            return `Не удалось разобрать имя пользователя ${userName}`;
        }

        const deviceLine = lines[lines.length - 1].split('📟');
        const device = deviceLine[deviceLine.length - 1];

        const messageDate = new Date(hitMessage.date * 1000);
        const moves = await app.dbUtil.dbPusher.pushNpcs([npc], device, messageDate, vkUserId, true, true);
        await app.service.notifier.notifyMoves(chatPeerId, moves, device, messageDate.getTime());

        if (
            !silentMode
            && process.env.IS_VHINFO_ENABLED === 'true'
        ) {
            sendHitToVhackInfo(hitMessage);
        }

        return `Координаты пользователя ${userName} сохранены`;
    }

    async function handleAnnounceMessage(announceMessage, day, vkUserId, chatPeerId) {
        message = announceMessage.text;
        if (
            !message.startsWith('📍Подозрительные пользователи были замечены на устройствах:')
            && !message.startsWith('🌐Новые цели для атаки в сети')
        ) {
            return;
        }

        const lines = message.split("\n");
        let addedNpcs = [];
        for (const line of lines) {
            const npcLocation = line.split(': 📟');
            if (npcLocation.length !== 2) {
                continue;
            }

            const npc = parser.parseNpc(npcLocation[0]);
            if (npc === null) {
                continue;
            }

            const deviceCode = npcLocation[1];

            // Announces only update NPCs we already know
            const foundNpc = await app.repository.npc.getOneByKey(npc.key);
            if (foundNpc === null) {
                continue;
            }

            const messageDate = new Date(announceMessage.date * 1000);
            const moves = await app.dbUtil.dbPusher.pushNpcs([npc], deviceCode, messageDate, vkUserId, false, true);
            await app.service.notifier.notifyMoves(chatPeerId, moves, deviceCode, messageDate.getTime());
            addedNpcs.push(npc.raw);
        }

        if (addedNpcs.length === 0) {
            return null;
        }

        return `Координаты пользователей ${addedNpcs.join(', ')} сохранены`;
    }

    // Keys are stored without U+FE0F: the game may or may not send the emoji variation selector
    const sectionHeaders = {
        '📍Пользователи:': 'users',
        '🌐Подключения:': 'connections',
        '⚙Сервисы:': 'services',
    };

    function getSectionHeader(line) {
        return sectionHeaders[line.replace(/️/g, '').trim()] || null;
    }

    async function sendDevicesToVhackInfo(userId, message, timestamp) {
        let apiDTO = {...app.service.vHackApi.getDeviceDTO()};
        apiDTO.ident = userId;
        apiDTO.timestamp = timestamp;

        let currentSection = null;
        const lines = message.split('\n')
        for (const line of lines) {
            const lineComponents = line.split(' ');

            if (line.startsWith('📟Устройство: ')) {
                apiDTO.device_info.device = line.substring(line.length - 8);
            }

            if (line.startsWith('👥Союзники: ')) {
                apiDTO.device_info.allies = parseInt(lineComponents[1]);
            }

            if (line.startsWith('👥Пользователи: ')) {
                apiDTO.device_info.users = parseInt(lineComponents[1]);
            }

            if (line === '') {
                currentSection = null;
                continue;
            }

            const header = getSectionHeader(line);
            if (header) {
                currentSection = header;
                // Service fields are sent only when the message has the section
                if (header === 'services') {
                    apiDTO.device_info.services = [];
                    apiDTO.device_info.broken_services = [];
                }
                continue;
            }

            if (currentSection === 'users') {
                const npc = parser.parseNpc(line);
                if (npc !== null) {
                    apiDTO.device_info.npcs.push({
                        "name": npc.afterType,
                        "npc": npc.type,
                        "type": "nu"
                    });
                }
            }

            if (currentSection === 'services') {
                const service = parser.parseService(line);
                if (service !== null) {
                    apiDTO.device_info.services.push({
                        "name": service.name,
                        "service": service.type,
                        "team": service.team,
                    });
                } else {
                    apiDTO.device_info.broken_services.push(line);
                }
            }

            if (currentSection === 'connections' && line.startsWith('📟')) {
                apiDTO.device_info.devices.push(line.match(/[A-F0-9]{8}/)[0]);
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

        apiDTO.npc_info.device = bossLocation;
        apiDTO.npc_info.name = bossName;
        apiDTO.npc_info.npc = 4;

        app.service.vHackApi.sendNpc(apiDTO);
    }
};
