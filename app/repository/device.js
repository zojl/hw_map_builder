module.exports = function(sequelize, models) {
    return {
        getOneById,
        getOneByCode,
        getAllByIds,
        getAllByCodes,
        getCodesByIds,
        getIdsByCodes
    }

    async function getOneById(id) {
        const deviceEntity = await models.devices.findOne({
            where: {
              id: id
            }
          });
        if (deviceEntity !== null) {
          return deviceEntity;
        } 

        return null;
    }

    async function getOneByCode(code) {
        code = code.substr(code.length - 2).toUpperCase();

        const deviceEntity = await models.devices.findOne({
            where: {
                code: code
            }
        });

        if (deviceEntity === null) {
            return null;
        } 

        return deviceEntity;
    }

    async function getAllByIds(ids) {
        const deviceEntities = await models.devices.findAll({
            where: {
                id: ids
            }
        });
        if (deviceEntities === null || deviceEntities.length == 0) {
            return [];
        }

        return deviceEntities;
    }

    async function getAllByCodes(codes) {
        codes = codes.map(code => code.substr(code.length - 2).toUpperCase())

        let deviceEntities = await models.devices.findAll({
            where: {
                code: codes
            }
        });

        if (deviceEntity === null || deviceEntities.length == 0) {
            return [];
        }

        return deviceEntities;
    }


    async function getCodesByIds(ids) {
        const deviceEntities = getAllByIds(ids);

        let codesByIds = {};
        for (const device of deviceEntities) {
            codesByIds[device.id] = device.code;
        }

        return codesByIds;
    }

    async function getIdsByCodes(codes) {
        const deviceEntities = getAllByCodes(codes);

        let idsByCodes = {};
        for (const device of deviceEntities) {
            idsByCodes[device.code] = device.id;
        }

        return idsByCodes;
    }
};