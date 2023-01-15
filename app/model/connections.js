module.exports = function(sequelize, DataTypes) {
  return sequelize.define('connections', {
    id: {
      type: DataTypes.INTEGER(11),
      allowNull: false,
      primaryKey: true,
      autoIncrement: true
    },
    source: {
      type: DataTypes.INTEGER(11),
      allowNull: false,
    },
    target: {
      type: DataTypes.INTEGER(11),
      allowNull: false,
    },
    cost: {
      type: DataTypes.INTEGER(11),
    },
    reverseCost: {
      type: DataTypes.INTEGER(11),
    },
    day: {
      type: DataTypes.INTEGER(11),
      allowNull: false
    }
  }, {
    tableName: 'connections'
  });
};