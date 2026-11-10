module.exports = function(sequelize, DataTypes) {
    return sequelize.define('services', {
        id: {
            type: DataTypes.INTEGER(),
            allowNull: false,
            primaryKey: true,
            autoIncrement: true
        },
        name: {
            type: DataTypes.STRING(64),
            allowNull: false,
        },
    }, {
        tableName: 'services'
    });
};
