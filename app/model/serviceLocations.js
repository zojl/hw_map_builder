module.exports = function(sequelize, DataTypes) {
    return sequelize.define('service_locations', {
        id: {
            type: DataTypes.INTEGER(),
            allowNull: false,
            primaryKey: true,
            autoIncrement: true
        },
        service: {
            type: DataTypes.INTEGER(),
            allowNull: false,
        },
        device: {
            type: DataTypes.INTEGER(),
            allowNull: false,
        },
        subnet: {
            type: DataTypes.INTEGER(),
            allowNull: false,
        },
        day: {
            type: DataTypes.INTEGER(),
            allowNull: false,
        },
        messageDate: {
            type: DataTypes.DATE(),
            allowNull: false,
        },
        vkUser: {
            type: DataTypes.INTEGER(),
            allowNull: false,
        },
    }, {
        tableName: 'serviceLocations'
    });
};
