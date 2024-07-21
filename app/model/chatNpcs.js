module.exports = function(sequelize, DataTypes) {
    return sequelize.define('chat_npcs', {
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
        chat: {
            type: DataTypes.INTEGER(),
            allowNull: false,
        }
    })
}