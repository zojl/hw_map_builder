module.exports =
    (app) => {
        const https = require('https');

        return {
            getDeviceDTO,
            getNpcDto,
            getTeamId,
            sendDevice,
            sendNpc,
        }

        function getBasicDTO() {
            return {
                "token": null, //токен клиента
                "ident": null, //идентификатор пользователя
                "timestamp": null,
                "transit": [ //куда пересылать
                    "alliance", //чат союза
                    "statbot", //статбот
                    "map", //интерактивная карта
                    "underbot", //"недо-бот" NK
                    "nhsmap", //бот НХС
                ],
                "no_transit": [] //кому не пересылать
            }
        }

        function getDeviceDTO() {
            let dto = {...getBasicDTO()};
            dto.device_info = {
                "files": [], //найденные файлы
                "broken_files": [], //файлы, которые не удалось распарсить
                "npcs": [], //найденные NPC
                "broken_npcs": [], //NPC, которых не удалось распарсить
                "users": 1, //количество игроков (пользователи игры)
                "defenders": 0, //количество защитников
                "allies": 0, //количество союзников
                "owner": -99, //кто контролирует точку, ID команды, 0 никто, -99 нет данных, -1 нецелевая, -2 безопасная (зеленая)
                "goal": -99, //-1 обычная, 0 общая точка выгрузки файлов, 1-6 командная, -99 н/д
                "load": -99, //-1 обычная, 0 общая точка появления файлов, 1-6 командная, -99 н/д
                "device": 0, //ID выбранного устройства 0-255
                "devices": {}, //Связанные устройства: адрес => объект (свойства пока не заданы)
                "type": "nn", //константа
            }

            return dto;
        }

        function getNpcDto() {
            let dto = {...getBasicDTO()};

            dto.npc_info = {
                "device": 0,
                "name": '',
                "npc": 0, // # 0 - неизвестен, 1 - смотрит (на 00), 2 - босс (старый), 3 - торговец, 4 - отслеживаемый
            }

            return dto;
        }

        function getTeamId(identificator) {
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

            if (identificator.toLowerCase() in teams) {
                return teams[identificator];
            }

            return null;
        }

        function sendDevice(dto) {
            if (process.env.IS_DUMP_VHINFO_OUT === 'true') {
                console.log(dto);
            }
            
            send(dto, '/api/network/device');
        }

        function sendNpc(dto) {
            send(dto, '/api/network/npc')
        }

        function send(data, path) {
            const url = process.env.VHINFO_HOST + path;
            data.token = process.env.VHINFO_TOKEN;
            data.ident = 'chinamap / ' + data.ident;

            const requestData = JSON.stringify(data);

            if (process.env.ENV === 'dev') {
                console.debug(requestData);
            }
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
                        app.sentry.captureMessage(body.toString());
                        console.error(body.toString());
                    });
                }
            });

            let rawBody = '';
            request.on('data', (chunk) => {
                rawBody += chunk;
            });
            request.on('end', async () => {
                const responseText = rawBody.toString();
                try {
                    const responseBody = JSON.parse(responseText)
                    if (!responseBody.success) {
                        app.sentry.captureMessage({
                            "request": requestData,
                            "response": responseText
                        });
                    }
                } catch (e) {
                    e.requestBody = requestData;
                    e.response = responseText;
                    app.sentry.captureException(e);
                }
            })
            request.on('error', (e) => {
                app.sentry.captureException(e);
                console.error('statBot api problem: ' + e.message);
            });
            request.write(requestData);
            request.end();
        }
    }
