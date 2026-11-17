module.exports = function(sequelize, models) {
    return {
        findLastBySubnet,
        findHistory,
    }

    // History of NPCs (one or all): per-NPC summary and every change of type, team,
    // name spelling or level between consecutive observations. Only forwarded game
    // messages count: vhack.info data and hit messages (name rebuilt by hand) add noise.
    async function findHistory(npcId = null) {
        const npcFilter = npcId === null ? '' : 'AND npc = :npcId';

        const [summaries] = await sequelize.query(`
            SELECT npc, count(*)::int AS count, min("messageDate") AS "firstSeen", max("messageDate") AS "lastSeen",
                (array_agg(raw ORDER BY "messageDate" DESC))[1] AS raw
            FROM "npcLocations"
            WHERE "vkUser" <> 0 AND NOT "isHit" ${npcFilter}
            GROUP BY npc
        `, {replacements: {npcId}});

        const [changes] = await sequelize.query(`
            SELECT * FROM (
                SELECT npc, "messageDate", "type", team, name, level,
                    LAG("type") OVER w AS "prevType",
                    LAG(team) OVER w AS "prevTeam",
                    LAG(name) OVER w AS "prevName",
                    LAG(level) OVER w AS "prevLevel",
                    ROW_NUMBER() OVER w AS n
                FROM "npcLocations"
                WHERE "vkUser" <> 0 AND NOT "isHit" ${npcFilter}
                WINDOW w AS (PARTITION BY npc ORDER BY "messageDate", id)
            ) observations
            WHERE n > 1 AND (
                "type" IS DISTINCT FROM "prevType"
                OR team IS DISTINCT FROM "prevTeam"
                OR name IS DISTINCT FROM "prevName"
                OR level IS DISTINCT FROM "prevLevel"
            )
            ORDER BY npc, "messageDate"
        `, {replacements: {npcId}});

        return {summaries, changes};
    }

    async function findLastBySubnet(subnetId) {
        let locations = await models.npcLocations.findAll({
            attributes: [
                sequelize.literal("DISTINCT ON (npc) id"),
                "npc",
                "device",
                "subnet",
                "messageDate",
                "vkUser",
                "isHit",
                "type",
                "team",
                "name",
                "level",
                "raw",
                "createdAt",
                "updatedAt",
                ],
            where: {
                subnet: subnetId
            },
            order: [
                ["npc"],
                ["messageDate", "DESC"],
            ],
        });

        return locations;
    }
}