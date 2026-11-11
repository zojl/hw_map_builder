const {findGrid} = require('../util/grid.js');

// /matrix 00 0F: today's links inside the range laid out as a grid, if they form one
module.exports = function(app) {
    app.bot.command('/matrix', async (ctx) => {
        await handleMatrix(ctx);
    });

    const helpMessage = 'Укажи диапазон устройств, например /matrix 00 0F или /matrix 00-0F';
    const maxListed = 16;

    const handleMatrix = async (ctx) => {
        const chat = await app.getChatFromMessage(ctx);
        if (chat === null) {
            return;
        }
        const subnet = await app.getSubnetFromChat(chat);
        if (subnet === null) {
            return;
        }

        const args = ctx.message.text.trim().split(/\s+/).slice(1);
        const bounds = args.length === 1 ? args[0].split('-') : args;
        if (bounds.length !== 2) {
            ctx.reply(helpMessage);
            return;
        }

        const start = parseCode(bounds[0], subnet.code);
        const end = parseCode(bounds[1], subnet.code);
        if (start === null || end === null) {
            ctx.reply(`Некорректное устройство. Нужен код из подсети ${subnet.code}: две шестнадцатеричные цифры (0F) или полный код (${subnet.code}0F).`);
            return;
        }
        if (start >= end) {
            ctx.reply('Начало диапазона должно быть меньше конца, например /matrix 00 0F');
            return;
        }

        const range = `📟${toCode(start)}–${toCode(end)}`;
        const codes = [];
        for (let value = start; value <= end; value++) {
            codes.push(toCode(value));
        }

        // A link counts in either direction: one known side is enough to place it
        const day = app.getDates().day;
        const connections = await app.repository.connection.getAllByDayAndSubnet(day, subnet.id);
        const deviceIds = [...new Set(connections.flatMap((connection) => [connection.source, connection.target]))];
        const codesByIds = deviceIds.length > 0 ? await app.repository.device.getCodesByIds(deviceIds) : {};
        const inRange = new Set(codes);
        const links = connections
            .map((connection) => [codesByIds[connection.source], codesByIds[connection.target]])
            .filter(([source, target]) => inRange.has(source) && inRange.has(target));

        const grid = findGrid(codes, links);
        if (grid.ok) {
            const rows = grid.rows;
            ctx.reply(`Сетка ${rows.length}×${rows[0].length} для ${range}:\n` + rows.map((row) => row.join(' ')).join('\n'));
            return;
        }

        const listed = grid.codes ? list(grid.codes) : '';
        const messages = {
            empty: `Внутри ${range} сегодня нет известных связей.`,
            isolated: `У этих устройств нет известных связей внутри ${range}: ${listed}. Сетку не построить, пока они не исследованы.`,
            degree: `Связи внутри ${range} не образуют сетку: у ${listed} больше четырёх соседей в диапазоне.`,
            disconnected: `Связи внутри ${range} не образуют сетку: диапазон распадается на несвязанные части, отдельно лежат ${listed}.`,
            shape: `Связи внутри ${range} не раскладываются в прямоугольную сетку.`,
        };
        ctx.reply(messages[grid.reason]);
    }

    // "0F", "F" or the full "AABBCC0F" of the chat's subnet → 15
    function parseCode(raw, subnetCode) {
        let code = raw.toUpperCase();
        if (code.length === 8) {
            if (code.substr(0, 6) !== subnetCode.toUpperCase()) {
                return null;
            }
            code = code.substr(6);
        }

        return /^[0-9A-F]{1,2}$/.test(code) ? parseInt(code, 16) : null;
    }

    function toCode(value) {
        return value.toString(16).toUpperCase().padStart(2, '0');
    }

    function list(codes) {
        const shown = codes.slice(0, maxListed).map((code) => '📟' + code).join(', ');
        return codes.length > maxListed ? `${shown} и ещё ${codes.length - maxListed}` : shown;
    }
}
