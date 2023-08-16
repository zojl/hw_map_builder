module.exports = function(app) {
    return {
        get: getLinks
    }

    async function getLinks(inCount, subnetId, day) {
        const query = `SELECT sd.code AS source, td.code AS target
        FROM connections
                 INNER JOIN devices AS td ON connections.target = td.id
                 INNER JOIN devices AS sd ON connections.source = sd.id
        WHERE DAY = ${day}
          AND subnet= ${subnetId}
          AND target IN
            (
                SELECT target FROM connections
                WHERE DAY = ${day}
                AND subnet = ${subnetId}
                GROUP BY target
                HAVING COUNT (SOURCE) = 1
            )
          AND SOURCE IN
          (
            SELECT target FROM connections
            WHERE DAY = ${day}
            AND subnet = ${subnetId}
            GROUP BY target
            HAVING COUNT (SOURCE) = ${inCount}
          )
        ;`;
        
        try {
            routeResult = await app.db.query(query);
            if (result[0].length == 0) {
                return null;
            }
        } catch (error) {
            return null;
        }
        
        return result;
    }
}