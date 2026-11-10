module.exports = function(sequelize, models) {
    return {
        findRecentMovesBySubnet,
    }

    // For every service in the subnet: its last `movesPerService` stays, newest first.
    // Consecutive observations on the same device are collapsed into one stay,
    // represented by its latest observation.
    async function findRecentMovesBySubnet(subnetId, movesPerService) {
        const [rows] = await sequelize.query(`
            SELECT service, device, "messageDate"
            FROM (
                SELECT stays.*,
                    ROW_NUMBER() OVER (PARTITION BY service ORDER BY "messageDate" DESC) AS move_number
                FROM (
                    SELECT service, device, "messageDate",
                        LEAD(device) OVER (PARTITION BY service ORDER BY "messageDate", id) AS next_device
                    FROM "serviceLocations"
                    WHERE subnet = :subnetId
                ) stays
                WHERE next_device IS DISTINCT FROM device
            ) moves
            WHERE move_number <= :movesPerService
            ORDER BY service, "messageDate" DESC
        `, {
            replacements: {subnetId, movesPerService},
        });

        return rows;
    }
}
