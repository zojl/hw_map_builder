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
      if (connection.substr(0, 6) != subnetCode) {
        console.log([connection.substr(0, 6), subnetCode]);
        continue;
      }
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

  async function findOrCreateNpc(username) {
    let npc = await models.npcs.findOne({
      where: {
        name: username
      }
    });

    if (npc !== null) {
      return npc;
    }

    npcEntity = await models.npcs.create({
      name: username
    })
    return npcEntity;
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

  const copyConnections = async function(connections, toDay) {
    let copied = 0;
    let skipped = 0;

    for (const connection of connections) {
      const existing = await models.connections.findOne({
        where: {
          source: connection.source,
          target: connection.target,
          subnet: connection.subnet,
          day: toDay
        }
      });

      if (existing !== null) {
        skipped++;
        continue;
      }

      await models.connections.create({
        source: connection.source,
        target: connection.target,
        subnet: connection.subnet,
        day: toDay,
        cost: connection.cost,
        reverseCost: connection.reverseCost,
      });
      copied++;
    }

    return { copied, skipped };
  }

  const pushUsers = async function(users, deviceFull, messageDate, vkUser, isHit) {
    const subnetCode = deviceFull.substr(0, 6);
    const deviceCode = deviceFull.substr(deviceFull.length - 2, 2);

    let subnet = await models.subnets.findOne({
      where: {
        code: subnetCode
      }
    });

    if(subnet === null) {
      return false
    }

    const device = await findOrCreateDevice(deviceFull);

    for (user of users) {
      const npc = await findOrCreateNpc(user);
      let npcLocation = await models.npcLocations.create({
        npc: npc.id,
        device: device.id,
        subnet: subnet.id,
        messageDate: messageDate,
        vkUser: vkUser,
        isHit: isHit,
      });
    }
  }

  async function findOrCreateService(name) {
    const service = await models.services.findOne({
      where: {
        name: name
      }
    });

    if (service !== null) {
      return service;
    }

    return await models.services.create({
      name: name
    });
  }

  // Every observation is kept (services move, history matters); re-forwarding the same message is skipped
  const pushServices = async function(services, deviceFull, day, messageDate, vkUser) {
    const subnetCode = deviceFull.substr(0, 6);

    const subnet = await models.subnets.findOne({
      where: {
        code: subnetCode
      }
    });

    if (subnet === null) {
      return false;
    }

    const device = await findOrCreateDevice(deviceFull);

    for (const name of services) {
      const service = await findOrCreateService(name);
      const existing = await models.serviceLocations.findOne({
        where: {
          service: service.id,
          device: device.id,
          subnet: subnet.id,
          messageDate: messageDate,
        }
      });

      if (existing !== null) {
        continue;
      }

      await models.serviceLocations.create({
        service: service.id,
        device: device.id,
        subnet: subnet.id,
        day: day,
        messageDate: messageDate,
        vkUser: vkUser,
      });
    }

    return true;
  }

  return {
    pushConnections: pushToDB,
    copyConnections,
    pushUsers,
    pushServices,
  };
};
