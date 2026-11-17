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

  // NPCs and services are looked up by name case-insensitively (see app/hw/parser.js).
  // The spelling from the game wins: vhack.info sometimes sends a lowercased name first.
  async function findOrCreateByName(model, name, fromGame) {
    const entity = await model.findOne({
      where: sequelize.where(sequelize.fn('lower', sequelize.col('name')), sequelize.fn('lower', name))
    });

    if (entity === null) {
      return await model.create({name: name});
    }

    if (fromGame && entity.name !== name) {
      await entity.update({name: name});
    }

    return entity;
  }

  async function findSubnetAndDevice(deviceFull) {
    const subnet = await models.subnets.findOne({
      where: {
        code: deviceFull.substr(0, 6)
      }
    });

    if (subnet === null) {
      return null;
    }

    return {subnet, device: await findOrCreateDevice(deviceFull)};
  }

  // Saves parsed observations. Returns the ones that mean a move: newer than the latest known
  // observation of that NPC/service and on another device (or the first one ever).
  // Re-forwarding the same message is skipped.
  async function pushObservations({entityModel, locationModel, fk, kind, items, place, messageDate, fromGame, fields}) {
    const moved = [];

    for (const item of items) {
      const entity = await findOrCreateByName(entityModel, item.name, fromGame);

      const duplicate = await locationModel.findOne({
        where: {
          [fk]: entity.id,
          device: place.device.id,
          subnet: place.subnet.id,
          messageDate: messageDate,
        }
      });
      if (duplicate !== null) {
        continue;
      }

      const previous = await locationModel.findOne({
        where: {
          [fk]: entity.id,
        },
        order: [['messageDate', 'DESC']],
      });

      await locationModel.create({
        [fk]: entity.id,
        device: place.device.id,
        subnet: place.subnet.id,
        messageDate: messageDate,
        type: item.type,
        team: item.team,
        name: item.name,
        raw: item.raw,
        ...fields(item),
      });

      const isMove = previous === null || (
        messageDate > previous.messageDate
        && (previous.device !== place.device.id || previous.subnet !== place.subnet.id)
      );
      if (isMove) {
        moved.push({kind, id: entity.id, raw: item.raw});
      }
    }

    return moved;
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

  // npcs: parsed with parser.parseNpc. fromGame: the data came from a forwarded game message.
  // Returns null if the subnet is unknown, otherwise the moves (see pushObservations).
  const pushNpcs = async function(npcs, deviceFull, messageDate, vkUser, isHit, fromGame) {
    const place = await findSubnetAndDevice(deviceFull);
    if (place === null) {
      return null;
    }

    return await pushObservations({
      entityModel: models.npcs,
      locationModel: models.npcLocations,
      fk: 'npc',
      kind: 'npc',
      items: npcs,
      place,
      messageDate,
      fromGame,
      fields: (npc) => ({level: npc.level, vkUser, isHit}),
    });
  }

  // services: parsed with parser.parseService. Same contract as pushNpcs.
  const pushServices = async function(services, deviceFull, day, messageDate, vkUser, fromGame) {
    const place = await findSubnetAndDevice(deviceFull);
    if (place === null) {
      return null;
    }

    return await pushObservations({
      entityModel: models.services,
      locationModel: models.serviceLocations,
      fk: 'service',
      kind: 'service',
      items: services,
      place,
      messageDate,
      fromGame,
      fields: () => ({day, vkUser}),
    });
  }

  return {
    pushConnections: pushToDB,
    copyConnections,
    pushNpcs,
    pushServices,
  };
};
