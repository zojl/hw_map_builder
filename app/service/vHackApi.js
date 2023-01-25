module.exports = 
(app) => {
    const https = require('https');

    return {
        getDefaultDTO,
        getTeamId,
        send
    }

    function getDefaultDTO () {
        return {
            "ident": null, //идентификатор пользователя
            "files": [], //найденные файлы
            "npcs": [], //найденные NPC
            "broken_files": [], //файлы, которые не удалось распарсить
            "broken_npcs": [], //NPC, которых не удалось распарсить
            "users": 1, //количество игроков (пользователи)
            "defenders": 0, //количество защитников
            "owner": 0, //кто контролирует точку, ID команды
            "goal": -1, //-1 обычная, 0 общая точка выгрузки файлов, 1-6 командная
            "load": -1, //-1 обычная, 0 общая точка появления файлов, 1-6 командная
            "target": false, //true, если возможен ПВП на устройстве
            "token": null, //токен клиента
            "device": 0, //ID выбранного устройства 0-255
            "device1": 0, //ID первого связанного устройства
            "device2": 0, //ID второго связанного устройства
            "device3": 0, //ID третьего связанного устройства
            "allies": 0, //количество союзников
            "type": "nn", //константа
            "transit": [ 
                "alliance", //пересылать в чат фракции
                "statbot", //пересылать в статбота
                "map" //добавлять на интерактивную карту
            ],
            "no_transit":[] //кому не пересылать
        }
    }

    function getTeamId (identificator) {
        const teams = {
            "💠": 1,
            "aegis": 1,
            "🚧": 2,
            "v-hack": 2,
            "🎭": 3,
            "phantoms": 3,
            "🈵": 4,
            "huǒqiáng": 4,
            "🔱": 5,
            "netkings": 5,
            "nhs": 6,
            "🇺🇸": 6
        }

        if (identificator in teams) {
            return teams[identificator];
        }

        return null;
    }

    function send(dto) {
        const url = process.env.VHINFO_HOST + '/api/network';
        dto.token = process.env.VHINFO_TOKEN;
        dto.ident = 'chinamap / ' + dto.ident;

        const requestData = JSON.stringify(dto);
        const options = { 
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(requestData),
                'User-Agent': 'c0nd0rs_map_builder/1.0'
            }
        }

        const request = https.request(url, options, (response) => {
            if (response.statusCode !== 200) {
                response.on('data', (body) => {
                    console.error(body.toString());
                });
            }
        });
        request.on('error', (e) => {
            console.error('statBot api problem: ' + e.message);
        });
        request.write(requestData);
        request.end();
    }
}