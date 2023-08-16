module.exports = function(sequelize, DataTypes) {
    return sequelize.define('npc_locations', {
        id: {
            type: DataTypes.INTEGER(),
            allowNull: false,
            primaryKey: true,
            autoIncrement: true
        },
        npc: {
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
        messageDate: {
            type: DataTypes.DATE(),
            allowNull: false,
        },
        vkUser: {
            type: DataTypes.INTEGER(),
            allowNull: false,
        },
        isHit: {
            type: DataTypes.BOOLEAN(),
            allowNull: false,
        }
    }, {
        tableName: 'npcLocations'
    });
};