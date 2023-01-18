module.exports = function(sequelize, DataTypes, ) {
  return sequelize.define('devices', {
    id: {
      type: DataTypes.INTEGER(),
      allowNull: false,
      primaryKey: true,
      autoIncrement: true
    },
    code: {
      type: DataTypes.STRING(2),
      allowNull: false,
    },  
  }, {
    tableName: 'devices'
  });
};