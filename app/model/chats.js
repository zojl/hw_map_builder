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
        comment: {
            type: DataTypes.STRING(256),
            allowNull: true,
        },
    }, {
        tableName: 'chats'
    });
};