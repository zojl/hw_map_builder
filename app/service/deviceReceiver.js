const parser = require('../hw/parser.js');

const ADDRESS_LENGTH = 8;

// Receives devices that vhack.info forwards to us
module.exports = function(app) {
    const express = require('express');
    const bodyParser = require('body-parser');

    const inhttp = express();
    inhttp.use(bodyParser.json());
    inhttp.use(bodyParser.urlencoded({ extended: false }))
    inhttp.listen(process.env.INCOMING_DEVICES_PORT);
    inhttp.post('/', handleReceivedDevice)
    console.log('listening to incoming devices started at ' + process.env.INCOMING_DEVICES_PORT)

    async function handleReceivedDevice(req, res) {
        if (process.env.IS_INCOMING_DUMP === 'true') {
            console.log(req);
        }

        const token = req.header('X-Auth-Token');
        if (token != process.env.VHINFO_IN_TOKEN) {
            res.status(401).json({ message: "Unauthorized or invalid token" });
            return;
        }

        let dates = app.getDates();

        const now = new Date();
        const updateTime = new Date(now.getFullYear(), now.getMonth(), dates.dayOfMonth, 18);
        const updateTimeStamp = updateTime.getTime() / 1000;

        if (updateTimeStamp > req.body.timestamp) {
            res.status(400).json({ message: "Requested data is too old" });
            return;
        }

        try {
            await saveDevice(req.body, dates.day);
        } catch (error) {
            console.error('Failed to save device from VI:', error);
            app.sentry.captureException(error);
            res.status(500).json({ message: "Failed to save the device" });
            return;
        }

        res.json({"status": "OK"});
    }

    async function saveDevice(body, day) {
        const sourceDevice = toDeviceCode(body.device.device);
        // VI moved devices from a list of addresses to a map keyed by address; accept both
        // TODO: drop the old list format once VI sends only the map
        const linked = body.device.devices || [];
        const targetDevices = (Array.isArray(linked) ? linked : Object.keys(linked)).map(toDeviceCode);
        const messageDate = new Date(body.timestamp * 1000);

        console.log('Received from VI (ident ' + body.ident  + '): ' + sourceDevice + ' linked to ' + targetDevices.join(', '));
        await app.dbUtil.dbPusher.pushConnections(sourceDevice, targetDevices, day);

        const npcs = [];
        for (const npc of body.device.npcs || []) {
            // VI sends the name without the type emoji, as we send it to them
            const parsed = parser.parseNpc(parser.npcTypeEmoji(npc.npc) + (npc.displayed_name ? npc.displayed_name : npc.name));
            if (parsed !== null) {
                npcs.push(parsed);
            }
        }

        if (npcs.length > 0) {
            const moves = await app.dbUtil.dbPusher.pushNpcs(npcs, sourceDevice, messageDate, 0, false, false);
            console.log(`Received from VI (ident ${body.ident}) users ${npcs.map((npc) => npc.raw).join(',')} at ${sourceDevice}`);
            await app.service.notifier.notifyMoves(null, moves, sourceDevice, messageDate.getTime());
        }

        const services = [];
        for (const service of body.device.services || []) {
            if (typeof(service.name) !== 'string' || service.name.trim() === '') {
                continue;
            }

            const item = {
                type: Number.isInteger(service.service) ? service.service : 0,
                team: Number.isInteger(service.team) ? service.team : -1,
                name: service.name.trim(),
            };
            services.push({...item, key: parser.toKey(item.name), raw: parser.formatService(item)});
        }

        if (services.length > 0) {
            const moves = await app.dbUtil.dbPusher.pushServices(services, sourceDevice, day, messageDate, 0, false);
            console.log(`Received from VI (ident ${body.ident}) services ${services.map((service) => service.raw).join(',')} at ${sourceDevice}`);
            await app.service.notifier.notifyMoves(null, moves, sourceDevice, messageDate.getTime());
        }
    }

    // An address is always 8 hex chars. Devices may come as numbers or as strings (map keys);
    // a string longer than an address made only of digits is a decimal number.
    // Keep leading zeros so the subnet code stays 6 chars.
    function toDeviceCode(device) {
        if (typeof device === 'string' && device.length > ADDRESS_LENGTH && /^\d+$/.test(device)) {
            device = Number(device);
        }
        const hex = typeof device === 'number' ? device.toString(16) : device;
        return hex.toUpperCase().padStart(ADDRESS_LENGTH, '0');
    }
}
