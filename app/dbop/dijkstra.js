module.exports = function(sequelize, models) {
  const getRoute = async function (sourceShort, targetShort, day) {
    const sourceId = await getDeviceIdByShortCode(sourceShort);
    const targetId = await getDeviceIdByShortCode(targetShort);

    const query = `SELECT * FROM pgr_dijkstra('SELECT id, source, target, cost, 256 FROM connections WHERE day = ${day}', ${sourceId}, ${targetId}, true);`;
    let routeResult = [];
    try {
        routeResult = await sequelize.query(query);
        if (routeResult[0].length == 0) {
            return null;
        }
    } catch (error) {
        return null;
    }

    let deviceIds = [];
    for (const node of routeResult[0]) {
        deviceIds.push(parseInt(node.node));
    }

    const codesByIds = await getDeviceCodesByIds(deviceIds);
    console.log(codesByIds);

    let codesSorted = [];
    for (const id of deviceIds) {
        codesSorted.push(codesByIds[id]);
    }

    return codesSorted;
  }

  async function getDeviceIdByShortCode(deviceCode) {
    let deviceEntity = await models.devices.findOne({
        where: {
          code: deviceCode.toUpperCase()
        }
      });
    if (deviceEntity !== null) {
      return deviceEntity.id;
    } 

    return null;
  }

  async function getDeviceCodesByIds(deviceIds) {
      let deviceEntities = await models.devices.findAll({
        where: {
          id: deviceIds
        }
      });

      let codesByIds = [];
      for (device of deviceEntities) {
        codesByIds[device.id] = device.code;
      }

      return codesByIds;
    }

  return getRoute;
}