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
        // VK user IDs no longer fit into INTEGER; existing tables are altered in index.js
        vkUser: {
            type: DataTypes.BIGINT(),
            allowNull: false,
        },
        isHit: {
            type: DataTypes.BOOLEAN(),
            allowNull: false,
        },
        // Parsed observation, see app/hw/parser.js. Added by scripts/migrate-names.js
        type: {
            type: DataTypes.INTEGER(),
        },
        team: {
            type: DataTypes.INTEGER(),
        },
        name: {
            type: DataTypes.STRING(64),
        },
        level: {
            type: DataTypes.INTEGER(),
        },
        raw: {
            type: DataTypes.STRING(128),
        },
    }, {
        tableName: 'npcLocations'
    });
};