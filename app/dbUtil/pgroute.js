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

  const getTspIds = async function(sourceId, minDeviceCode, maxDeviceCode, day, subnetId) {
    const minDeviceCodeDec = parseInt(minDeviceCode, 16);
    const maxDeviceCodeDec = parseInt(maxDeviceCode, 16);
    const query = 'SELECT seq, node, code, cost, agg_cost FROM pgr_TSP(\n'
        + '  $$\n'
        + '    SELECT * FROM pgr_dijkstraCostMatrix(\n'
        + `      'SELECT id, source, target, cost, 255 AS reverse_cost FROM connections WHERE subnet = ${subnetId} AND day = ${day} AND target IN (SELECT id FROM devices WHERE hex2dec(code) >= ${minDeviceCodeDec} AND hex2dec(code) <= ${maxDeviceCodeDec}) AND source IN (SELECT id FROM devices WHERE hex2dec(code) >= ${minDeviceCodeDec} AND hex2dec(code) <= ${maxDeviceCodeDec})\', ` + '\n'
        + '      (SELECT array_agg(id) FROM devices)\n'
        + '    )\n'
        + '  $$,\n'
        + sourceId + '\n'
      + ') AS route\n'
      + 'INNER JOIN devices ON route.node = devices.id;';

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

    let steps = [];
    let prevStep = routeResult[0][0].code;
    let prevStepId = routeResult[0][0].node;
    for (const step of routeResult[0]) {
      if (step.seq == 1) {
        continue;
      }
      
      if (step.cost == 1) {
        steps.push([prevStep, step.code])
        prevStep = step.code;
        prevStepId = step.node;
        continue;
      }
      
      let substeps = [];
      const stepRoute = await getRouteIds(prevStepId, step.node, day, subnetId);
      const codesByIds = await app.repository.device.getCodesByIds(stepRoute);
      
      for (const id of stepRoute) {
        substeps.push(codesByIds[id]);
      }
      
      steps.push(substeps);
      prevStep = step.code;
      prevStepId = step.node;
    }
    
    return steps;
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

  return {getRoute, getRouteIds, getTspIds};
}