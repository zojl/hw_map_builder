module.exports = function(sequelize, models) {
  const pushToDB = async function (deviceFull, connections, day) {
    const src = await findOrCreateDevice(deviceFull);
    let result = true;

    for (const connection of connections) {
      const target = await findOrCreateDevice(connection);
      result = result && await createConnection(src, target, day);
    };

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

  async function createConnection(source, target, day) {
    let connectionEntity = await models.connections.findOne({
      where: {
        source: source.id,
        target: target.id,
        day: day
      }
    });

    if (connectionEntity !== null) {
      return false;
    }

    connectionEntity = await models.connections.create({
        source: source.id,
        target: target.id,
        day: day
    });

    return true;
  }

  return pushToDB;
};