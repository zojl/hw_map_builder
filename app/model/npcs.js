module.exports = function(sequelize, DataTypes) {
  return sequelize.define('npcs', {
    id: {
      type: DataTypes.INTEGER(),
      allowNull: false,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING(32),
      allowNull: false,
    },  
  }, {
    tableName: 'npcs'
  });
};