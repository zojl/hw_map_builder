module.exports = function(app) {
    app.bot.command('/copylinks', async (ctx) => {
        handleCopyLinks(ctx)
    });

    app.bot.command('/cl ', async (ctx) => {
        handleCopyLinks(ctx)
    });

    const handleCopyLinks = async (ctx) => {
        const args = ctx.message.text.split(' ');
        if (args.length < 2) {
            ctx.reply('Укажи устройства, например /copylinks ABCDEF00-ABCDEF1F,ABCDEF20,ABCDEF25');
            return;
        }

        const parsed = parseDeviceSpec(args[1]);
        if (parsed === null) {
            ctx.reply('Не получилось разобрать список устройств. Формат: ABCDEF00-ABCDEF1F,ABCDEF20,ABCDEF25 — диапазоны и отдельные устройства одной подсети через запятую, без пробелов.');
            return;
        }

        const subnet = await app.repository.subnet.getOneByCode(parsed.subnetCode);
        if (subnet === null) {
            ctx.reply(`Я не знаю подсеть ${parsed.subnetCode}`);
            return;
        }

        const devices = await app.repository.device.getAllByCodes(parsed.codes);
        if (devices.length === 0) {
            ctx.reply('Ни одно из указанных устройств мне не известно.');
            return;
        }

        const deviceIds = devices.map(device => device.id);
        const today = app.getDates();
        const yesterday = app.getDates(-1);

        const connections = await app.repository.connection.getAllBySourceIdsDayAndSubnet(deviceIds, yesterday.day, subnet.id);
        if (connections.length === 0) {
            ctx.reply('Вчера не было связей от указанных устройств в этой подсети.');
            return;
        }

        const result = await app.dbUtil.dbPusher.copyConnections(connections, today.day);
        ctx.reply(`Перенесено связей со вчера на сегодня: ${result.copied}. Уже были сегодня (пропущено): ${result.skipped}.`);
    }

    function parseDeviceSpec(spec) {
        const parts = spec.split(',');
        let subnetCode = null;
        let codes = new Set();

        for (const part of parts) {
            const rangeMatch = part.match(/^([0-9a-f]{8})-([0-9a-f]{8})$/i);
            const singleMatch = part.match(/^([0-9a-f]{8})$/i);

            if (rangeMatch) {
                const startFull = rangeMatch[1];
                const endFull = rangeMatch[2];
                const startSubnet = startFull.substr(0, 6).toUpperCase();
                const endSubnet = endFull.substr(0, 6).toUpperCase();
                if (startSubnet !== endSubnet || (subnetCode !== null && subnetCode !== startSubnet)) {
                    return null;
                }
                subnetCode = startSubnet;

                const start = parseInt(startFull.substr(6, 2), 16);
                const end = parseInt(endFull.substr(6, 2), 16);
                if (start > end) {
                    return null;
                }

                for (let i = start; i <= end; i++) {
                    codes.add(i.toString(16).padStart(2, '0').toUpperCase());
                }
            } else if (singleMatch) {
                const full = singleMatch[1];
                const currentSubnet = full.substr(0, 6).toUpperCase();
                if (subnetCode !== null && subnetCode !== currentSubnet) {
                    return null;
                }
                subnetCode = currentSubnet;
                codes.add(full.substr(6, 2).toUpperCase());
            } else {
                return null;
            }
        }

        if (subnetCode === null) {
            return null;
        }

        return { subnetCode, codes: Array.from(codes) };
    }
}
