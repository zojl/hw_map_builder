module.exports = function(sequelize, models) {
  const pushToDB = async function (deviceFull, connections, day) {
    let subnetCode = deviceFull.substr(0, 6);
    let subnet = await models.subnets.findOne({
          where: {
              code: subnetCode
          }
      });

    if(subnet === null) {
      return false
    }

    const src = await findOrCreateDevice(deviceFull);
    let result = true;

    for (const connection of connections) {
      const target = await findOrCreateDevice(connection);
      result = result && await createConnection(src, target, day, subnet.id);
    }

    return result;
  }

  async function findOrCreateDevice(deviceFull) {
    const deviceCode = deviceFull.substr(deviceFull.length - 2, 2);
    let deviceEntity = await models.devices.findOne({
        where: {
          code: deviceCode
        }
      });
    if (deviceEntity !== null) {
      return deviceEntity;
    }

    deviceEntity = await models.devices.create({
      code: deviceCode
    })
    return deviceEntity;
  }

  async function createConnection(source, target, day, subnetId) {
    let connectionEntity = await models.connections.findOne({
      where: {
        source: source.id,
        target: target.id,
        subnet: subnetId,
        day: day
      }
    });

    if (connectionEntity !== null) {
      return false;
    }

    connectionEntity = await models.connections.create({
        source: source.id,
        target: target.id,
        subnet: subnetId,
        day: day,
        cost: 1,
        reverseCost: 255,
    });

    return true;
  }

  return pushToDB;
};