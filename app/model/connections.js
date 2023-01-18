module.exports = function(sequelize, DataTypes) {
  return sequelize.define('connections', {
    id: {
      type: DataTypes.INTEGER(),
      allowNull: false,
      primaryKey: true,
      autoIncrement: true
    },
    source: {
      type: DataTypes.INTEGER(),
      allowNull: false,
    },
    target: {
      type: DataTypes.INTEGER(),
      allowNull: false,
    },
    cost: {
      type: DataTypes.INTEGER(),
    },
    reverseCost: {
      type: DataTypes.INTEGER(),
    },
    day: {
      type: DataTypes.INTEGER(),
      allowNull: false
    }
  }, {
    tableName: 'connections'
  });
};