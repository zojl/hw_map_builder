module.exports = function(sequelize, DataTypes, ) {
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
    }, {
        tableName: 'chats'
    });
};