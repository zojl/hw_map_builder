module.exports = function(sequelize, DataTypes) {
    return sequelize.define('chat_services', {
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
        chat: {
            type: DataTypes.INTEGER(),
            allowNull: false,
        }
    }, {
        tableName: 'chat_services'
    });
};
