require('dotenv').config();
const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const getDates = require('../app/util/dates.js');

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

async function main() {
    const spec = process.argv[2];
    if (!spec) {
        console.error('Использование: node scripts/copylinks.js ABCDEF00-ABCDEF1F,ABCDEF20,ABCDEF25');
        process.exitCode = 1;
        return;
    }

    const parsed = parseDeviceSpec(spec);
    if (parsed === null) {
        console.error('Не получилось разобрать список устройств. Формат: ABCDEF00-ABCDEF1F,ABCDEF20,ABCDEF25 — диапазоны и отдельные устройства одной подсети через запятую, без пробелов.');
        process.exitCode = 1;
        return;
    }

    const db = new Sequelize(process.env.DB, { logging: false });
    db.Op = Sequelize.Op;

    const modelDir = path.join(__dirname, '../app/model');
    const model = {};
    for (const file of fs.readdirSync(modelDir)) {
        model[file.split('.')[0]] = require(path.join(modelDir, file))(db, Sequelize);
    }

    const repoDir = path.join(__dirname, '../app/repository');
    const repository = {};
    for (const file of fs.readdirSync(repoDir)) {
        repository[file.split('.')[0]] = require(path.join(repoDir, file))(db, model);
    }

    const dbPusher = require('../app/dbUtil/dbPusher.js')(db, model);

    try {
        const subnet = await repository.subnet.getOneByCode(parsed.subnetCode);
        if (subnet === null) {
            console.error(`Подсеть ${parsed.subnetCode} не найдена.`);
            process.exitCode = 1;
            return;
        }

        const devices = await repository.device.getAllByCodes(parsed.codes);
        if (devices.length === 0) {
            console.error('Ни одно из указанных устройств не найдено.');
            process.exitCode = 1;
            return;
        }
        const deviceIds = devices.map(device => device.id);

        const today = getDates();
        const yesterday = getDates(-1);

        const connections = await repository.connection.getAllBySourceIdsDayAndSubnet(deviceIds, yesterday.day, subnet.id);
        if (connections.length === 0) {
            console.log('Вчера не было связей от указанных устройств в этой подсети.');
            return;
        }

        const result = await dbPusher.copyConnections(connections, today.day);
        console.log(`Перенесено связей со вчера на сегодня: ${result.copied}. Уже были сегодня (пропущено): ${result.skipped}.`);
    } finally {
        await db.close();
    }
}

main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
});
