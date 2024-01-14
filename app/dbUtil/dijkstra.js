module.exports = function(app) {
  const getRoute = async function (sourceShort, targetShort, day, subnetId) {
    const sourceId = await getDeviceIdByShortCode(sourceShort);
    const targetId = await getDeviceIdByShortCode(targetShort);

    const deviceIds = await getRouteIds(sourceId, targetId, day, subnetId);
    const codesByIds = await app.repository.device.getCodesByIds(deviceIds);

    let codesSorted = [];
    for (const id of deviceIds) {
      codesSorted.push(codesByIds[id]);
    }

    return codesSorted;
  }

  const getRouteIds = async function(sourceId, targetId, day, subnetId) {
    const query = `SELECT * FROM pgr_dijkstra('SELECT id, source, target, cost, 256 FROM connections WHERE day = ${day} AND subnet = ${subnetId}', ${sourceId}, ${targetId}, true);`;
    let routeResult = [];
    try {
      routeResult = await app.db.query(query);
      if (routeResult[0].length == 0) {
        return [];
      }
    } catch (error) {
      console.log(error);
      return [];
    }

    let deviceIds = [];
    for (const node of routeResult[0]) {
      deviceIds.push(parseInt(node.node));
    }

    return deviceIds;
  }

  async function getDeviceIdByShortCode(deviceCode) {
    let deviceEntity = await app.model.devices.findOne({
        where: {
          code: deviceCode.toUpperCase()
        }
      });
    if (deviceEntity !== null) {
      return deviceEntity.id;
    }

    return null;
  }

  return {getRoute, getRouteIds};
}