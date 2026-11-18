module.exports = function(sequelize, DataTypes) {
    return sequelize.define('chats', {
        id: {
            type: DataTypes.INTEGER(),
            allowNull: false,
            primaryKey: true,
            autoIncrement: true
        },
        peerId: {
            type: DataTypes.INTEGER(),
            allowNull: false,
            unique: true,
        },
        subnet: {
            type: DataTypes.INTEGER(),
            allowNull: false,
        },
        delimiter: {
            type: DataTypes.STRING(8),
            allowNull: true,
        },
        canSeeNpc: {
            type: DataTypes.BOOLEAN(),
            allowNull: true,
        },
        // /history; existing tables get the column in index.js
        canSeeHistory: {
            type: DataTypes.BOOLEAN(),
            allowNull: true,
        },
        // /map and the map page; existing tables get the column in index.js
        canSeeMap: {
            type: DataTypes.BOOLEAN(),
            allowNull: true,
        },
        comment: {
            type: DataTypes.STRING(256),
            allowNull: true,
        },
    }, {
        tableName: 'chats'
    });
};