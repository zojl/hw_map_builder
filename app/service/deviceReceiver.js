module.exports = function(app) {
    const express = require('express');
    const bodyParser = require('body-parser');
    
    inhttp = express();
    inhttp.use(bodyParser.json());
    inhttp.use(bodyParser.urlencoded({ extended: false }))
    inhttp.listen(process.env.INCOMING_DEVICES_PORT);
    inhttp.post('/', handleReceivedDevice)
    console.log('listening to incoming devices started at ' + process.env.INCOMING_DEVICES_PORT)

    function handleReceivedDevice(req, res) {
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

        const sourceDevice = req.body.device.device.toString(16).toUpperCase();
        let targetDevices = [];
        
        for (const dec of req.body.device.devices) {
            targetDevices.push(dec.toString(16).toUpperCase());
        };

        console.log('Received from VI: ' + sourceDevice + ' linked to ' + targetDevices.join(', '));
        const result = app.dbUtil.dbPusher.pushConnections(sourceDevice, targetDevices, dates.day);
        
        if (req.body.device.npcs.length > 0) {
            let users = [];
            for (const npc of req.body.device.npcs) {
                const prefix = getNpcPrefixByTypeId(npc.npc)
                if (prefix === null) {
                    continue;
                }
                
                const npcName = npc.displayed_name ? npc.displayed_name: npc.name;
                users.push(prefix + npcName);
            }
            
            // const ident = JSON.parse(req.body.ident);
            app.dbUtil.dbPusher.pushUsers(
                users,
                sourceDevice,
                req.body.timestamp * 1000,
                0, // ident.from_id,
                false
            );
            console.log(`Received from VI users ${users.join(',')} at ${sourceDevice}`)
        }
        res.json({"status": "OK"});
    }

    function getNpcPrefixByTypeId(type) {
        if (type === 6) {
            return '🤖'
        }

        if (type === 5) {
            return '🚨'
        }

        if (type === 4) {
            return '🎯'
        }

        if (type === 3) {
            return '⚖'
        }
        
        if (type === 2) {
            return '⚔';
        }
        
        if (type === 1) {
            return '👀';
        }
        
        return null;
    }
}
