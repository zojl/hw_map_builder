module.exports = function(sequelize, DataTypes) {
    return sequelize.define('subnets', {
        id: {
            type: DataTypes.INTEGER(),
            allowNull: false,
            primaryKey: true,
            autoIncrement: true,
        },
        code: {
            type: DataTypes.STRING(6),
            allowNull: false,
            unique: true,
        },
        length: {
            type: DataTypes.INTEGER(),
            allowNull: true,
        }
    }, {
        tableName: 'subnets'
    });
};