module.exports =
    (app) => {
        // got is ESM-only; Node 22+ can require() it, the client is its default export
        const got = require('got').default;

        // Fail fast instead of hanging on a slow VI: 100ms to connect (TCP and TLS each),
        // then 300ms to get the response
        const TIMEOUT = { connect: 100, secureConnect: 100, response: 300 };

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
            
            return send(dto, '/api/network/device');
        }

        function sendNpc(dto) {
            return send(dto, '/api/network/npc');
        }

        // Never rejects: callers don't await it, errors are logged here
        async function send(data, path) {
            const url = process.env.VHINFO_HOST + path;
            data.token = process.env.VHINFO_TOKEN;
            data.ident = 'chinamap / ' + data.ident;

            const requestData = JSON.stringify(data);

            if (process.env.ENV === 'dev') {
                console.debug(requestData);
            }
            try {
                const response = await got.post(url, {
                    headers: {
                        'Content-Type': 'application/json',
                        'User-Agent': 'c0nd0rs_map_builder/1.0'
                    },
                    body: requestData,
                    timeout: TIMEOUT,
                    retry: { limit: 0 },
                    throwHttpErrors: false, // non-200 answers are reported by handleResponse
                });
                handleResponse(response.statusCode, response.body, requestData);
            } catch (e) {
                app.sentry.captureException(e);
                console.error('vhack.info api problem (' + path + '): ' + e.message);
            }
        }

        function handleResponse(statusCode, responseText, requestData) {
            if (statusCode !== 200) {
                app.sentry.captureMessage(responseText);
                console.error(responseText);
                return;
            }

            try {
                const responseBody = JSON.parse(responseText);
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
        }
    }
