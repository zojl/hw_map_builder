// Migrates NPCs and services to parsed storage (see app/hw/parser.js):
// - adds type/team/name/level/raw columns to observations, creates chat_services;
// - parses every observation's raw string (the old full name on the first run);
// - merges entities that share a key, moving observations and subscriptions;
// - stores the display name (without type/team/level) in npcs.name / services.name.
// Safe to re-run, e.g. after adding a team to app/hw/dictionaries.js.
// Without --apply everything runs in a transaction that is rolled back: a dry run.
require('dotenv').config();
const Sequelize = require('sequelize');
const parser = require('../app/hw/parser.js');

const apply = process.argv.includes('--apply');

const entities = [
    {
        label: 'NPC',
        table: 'npcs',
        locations: 'npcLocations',
        subscriptions: 'chat_npcs',
        fk: 'npc',
        hasLevel: true,
        parse: (raw) => parser.parseNpc(raw)
            || {type: null, team: -1, name: raw.trim(), level: null, key: parser.toKey(raw), unparsed: true},
    },
    {
        label: 'Сервисы',
        table: 'services',
        locations: 'serviceLocations',
        subscriptions: 'chat_services',
        fk: 'service',
        hasLevel: false,
        parse: (raw) => parser.parseService(raw)
            || {type: 0, team: -1, name: raw.trim(), key: parser.toKey(raw), unparsed: true},
    },
];

async function main() {
    const db = new Sequelize(process.env.DB, {logging: false});
    const t = await db.transaction();
    const select = (sql, replacements = {}) => db.query(sql, {replacements, transaction: t, type: Sequelize.QueryTypes.SELECT});
    const run = (sql, replacements = {}) => db.query(sql, {replacements, transaction: t});

    try {
        await migrateSchema(run);
        for (const entity of entities) {
            await migrateEntity(entity, select, run);
        }

        if (apply) {
            await t.commit();
            console.log('\nИзменения применены.');
        } else {
            await t.rollback();
            console.log('\nПробный запуск: изменения откачены. Для применения: npm run migrate-names -- --apply');
        }
    } catch (error) {
        await t.rollback();
        throw error;
    } finally {
        await db.close();
    }
}

async function migrateSchema(run) {
    await run(`ALTER TABLE "npcLocations"
        ADD COLUMN IF NOT EXISTS "type" integer,
        ADD COLUMN IF NOT EXISTS team integer,
        ADD COLUMN IF NOT EXISTS name varchar(64),
        ADD COLUMN IF NOT EXISTS level integer,
        ADD COLUMN IF NOT EXISTS raw varchar(128)`);
    await run(`ALTER TABLE "serviceLocations"
        ADD COLUMN IF NOT EXISTS "type" integer,
        ADD COLUMN IF NOT EXISTS team integer,
        ADD COLUMN IF NOT EXISTS name varchar(64),
        ADD COLUMN IF NOT EXISTS raw varchar(128)`);
    await run(`CREATE TABLE IF NOT EXISTS chat_services (
        id serial PRIMARY KEY,
        service integer NOT NULL,
        chat integer NOT NULL,
        "createdAt" timestamptz NOT NULL,
        "updatedAt" timestamptz NOT NULL)`);
}

async function migrateEntity(entity, select, run) {
    const {table, locations, subscriptions, fk} = entity;
    console.log(`\n=== ${entity.label} ===`);

    // First run: observations get the old full name as their raw string
    await run(`UPDATE "${locations}" l SET raw = e.name FROM "${table}" e WHERE l."${fk}" = e.id AND l.raw IS NULL`);

    // Parse every distinct raw string once
    const raws = await select(`SELECT raw, count(*)::int AS count,
            max("messageDate") FILTER (WHERE "vkUser" <> 0) AS "gameDate",
            max("messageDate") AS "anyDate"
        FROM "${locations}" WHERE raw IS NOT NULL GROUP BY raw`);
    const parsedByRaw = new Map();
    for (const row of raws) {
        parsedByRaw.set(row.raw, {...entity.parse(row.raw), ...row});
    }

    // Display name per key: the latest spelling from the game, otherwise the latest at all
    const display = new Map();
    for (const parsed of parsedByRaw.values()) {
        const current = display.get(parsed.key);
        const better = current === undefined
            || (parsed.gameDate !== null && (current.gameDate === null || parsed.gameDate > current.gameDate))
            || (parsed.gameDate === null && current.gameDate === null && parsed.anyDate > current.anyDate);
        if (better) {
            display.set(parsed.key, parsed);
        }
    }

    // Key of each entity row: from its latest observation, or from its own name if it has none
    const rows = await select(`SELECT e.id, e.name, latest.raw
        FROM "${table}" e
        LEFT JOIN (SELECT DISTINCT ON ("${fk}") "${fk}", raw FROM "${locations}" ORDER BY "${fk}", "messageDate" DESC) latest
            ON latest."${fk}" = e.id
        ORDER BY e.id`);
    const rowsByKey = new Map();
    for (const row of rows) {
        const key = row.raw !== null ? parsedByRaw.get(row.raw).key : entity.parse(row.name).key;
        row.key = key;
        if (!rowsByKey.has(key)) {
            rowsByKey.set(key, []);
        }
        rowsByKey.get(key).push(row);
    }

    // One surviving row per key (lowest id); keys without a row get a new one
    const survivors = new Map();
    let created = 0;
    for (const key of new Set([...rowsByKey.keys(), ...display.keys()])) {
        const name = display.has(key) ? display.get(key).name : entity.parse(rowsByKey.get(key)[0].name).name;
        if (rowsByKey.has(key)) {
            survivors.set(key, {id: rowsByKey.get(key)[0].id, name});
        } else {
            const [inserted] = await select(`INSERT INTO "${table}" (name, "createdAt", "updatedAt") VALUES (:name, now(), now()) RETURNING id`, {name});
            survivors.set(key, {id: inserted.id, name});
            created++;
        }
    }

    // Observations: parsed fields and the surviving entity
    for (const parsed of parsedByRaw.values()) {
        await run(`UPDATE "${locations}" SET "type" = :type, team = :team, name = :name${entity.hasLevel ? ', level = :level' : ''}, "${fk}" = :target WHERE raw = :raw`, {
            type: parsed.type,
            team: parsed.team,
            name: parsed.name,
            level: entity.hasLevel ? parsed.level : null,
            target: survivors.get(parsed.key).id,
            raw: parsed.raw,
        });
    }

    // Subscriptions of merged rows move to the survivor, duplicates are dropped
    const merged = rows.filter((row) => row.id !== survivors.get(row.key).id);
    for (const row of merged) {
        await run(`UPDATE "${subscriptions}" SET "${fk}" = :target WHERE "${fk}" = :id`, {target: survivors.get(row.key).id, id: row.id});
    }
    const [, dedup] = await run(`DELETE FROM "${subscriptions}" a USING "${subscriptions}" b
        WHERE a."${fk}" = b."${fk}" AND a.chat = b.chat AND a.id > b.id`);

    // Merged rows are no longer referenced
    const mergedIds = merged.map((row) => row.id);
    if (mergedIds.length > 0) {
        const [left] = await select(`SELECT
            (SELECT count(*) FROM "${locations}" WHERE "${fk}" IN (:ids))::int AS locations,
            (SELECT count(*) FROM "${subscriptions}" WHERE "${fk}" IN (:ids))::int AS subscriptions`, {ids: mergedIds});
        if (left.locations > 0 || left.subscriptions > 0) {
            throw new Error(`${entity.label}: на слитые записи всё ещё ссылаются: ${JSON.stringify(left)}`);
        }
        await run(`DELETE FROM "${table}" WHERE id IN (:ids)`, {ids: mergedIds});
    }

    // Display names
    const renamed = [];
    const rowById = new Map(rows.map((row) => [row.id, row]));
    for (const {id, name} of survivors.values()) {
        const row = rowById.get(id);
        if (row === undefined || row.name !== name) {
            await run(`UPDATE "${table}" SET name = :name WHERE id = :id`, {name, id});
            renamed.push({id, from: row ? row.name : null, to: name});
        }
    }

    report(entity, {raws: parsedByRaw, rows, rowsByKey, survivors, merged, created, renamed, dedup});
}

function report(entity, {raws, rows, rowsByKey, survivors, merged, created, renamed, dedup}) {
    const unparsed = [...raws.values()].filter((parsed) => parsed.unparsed);
    console.log(`Записей было: ${rows.length}, станет: ${survivors.size} (слито: ${merged.length}, создано: ${created}).`);
    console.log(`Разных исходных строк в наблюдениях: ${raws.size}.`);

    if (unparsed.length > 0) {
        console.log(`Не разобраны (сохранятся целиком как имя): ${unparsed.map((p) => JSON.stringify(p.raw)).join(', ')}`);
    }

    const merges = [...rowsByKey.entries()].filter(([, group]) => group.length > 1);
    if (merges.length > 0) {
        console.log('Слияния:');
        for (const [key, group] of merges) {
            const survivor = survivors.get(key);
            console.log(`  ${survivor.name} (#${survivor.id}) ← ${group.filter((row) => row.id !== survivor.id).map((row) => `#${row.id} ${row.name}`).join(', ')}`);
        }
    }

    console.log('Имена:');
    for (const {id, from, to} of renamed) {
        console.log(`  #${id}: ${from === null ? '(новая запись)' : from} → ${to}`);
    }

    console.log(`Повторных подписок удалено: ${dedup.rowCount || 0}.`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
