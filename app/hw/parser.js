// Parsing of game names: "<type emoji>[<team emoji>]<name>[ (<level>)]".
// Everything after the type that is not a known team stays in the name
// (markers like 🔸 included). Keys are lowercased names: the lookup key
// for npcs/services, so case and level/type/team changes don't split records.
const dictionaries = require('./dictionaries.js');

const VS16 = /️/g;
// One leading emoji: a flag (two regional indicators) or a pictographic char,
// optionally with VS16 and ZWJ sequences
const LEADING_EMOJI = /^(?:[\u{1F1E6}-\u{1F1FF}]{2}|\p{Extended_Pictographic}️?(?:‍\p{Extended_Pictographic}️?)*)/u;
const LEVEL = /\s*\((\d+|░+)\)\s*$/;

function prepare(entries) {
    return entries
        .map((entry) => ({...entry, match: entry.emoji.replace(VS16, '')}))
        .sort((a, b) => b.match.length - a.match.length);
}

const npcTypes = prepare(dictionaries.npcTypes);
const serviceTypes = prepare(dictionaries.serviceTypes);
const teams = prepare(dictionaries.teams);

// Returns {entry, rest} if the string starts with one of the entries' emoji (VS16-insensitive)
function matchPrefix(str, entries) {
    const normalized = str.replace(VS16, '');
    for (const entry of entries) {
        if (!normalized.startsWith(entry.match)) {
            continue;
        }

        // Walk the original string to cut the same number of non-VS16 code units
        let consumed = 0;
        let i = 0;
        while (consumed < entry.match.length && i < str.length) {
            if (str[i] !== '️') {
                consumed++;
            }
            i++;
        }
        while (str[i] === '️') {
            i++;
        }

        return {entry, rest: str.slice(i)};
    }

    return null;
}

function cutTeam(str) {
    const team = matchPrefix(str, teams);
    if (team === null) {
        return {team: dictionaries.unknownTeam, rest: str};
    }

    return {team: team.entry.id, rest: team.rest};
}

// NPC: the type must be known (the users section also lists real players).
// Returns {type, team, name, level, key, raw, afterType} or null;
// afterType is the line without the type emoji, the format vhack.info gets NPC names in.
function parseNpc(line) {
    const raw = line.trim();
    const type = matchPrefix(raw, npcTypes);
    if (type === null) {
        return null;
    }

    // The game sometimes puts a space after the type emoji
    const {team, rest} = cutTeam(type.rest.trimStart());

    let name = rest;
    let level = null;
    const levelMatch = name.match(LEVEL);
    if (levelMatch) {
        name = name.slice(0, levelMatch.index);
        level = /^\d+$/.test(levelMatch[1]) ? parseInt(levelMatch[1], 10) : null;
    }

    name = name.trim();
    if (name === '') {
        return null;
    }

    return {type: type.entry.id, team, name, level, key: toKey(name), raw, afterType: type.rest.trim()};
}

// Service: any leading emoji is the type (0 when unknown), the section holds only services.
// Returns {type, team, name, key, raw} or null when the line can't be parsed.
function parseService(line) {
    const raw = line.trim();
    let type;
    let rest;

    const known = matchPrefix(raw, serviceTypes);
    if (known !== null) {
        type = known.entry.id;
        rest = known.rest;
    } else {
        const unknown = raw.match(LEADING_EMOJI);
        if (unknown === null) {
            return null;
        }
        type = dictionaries.unknownServiceType;
        rest = raw.slice(unknown[0].length);
    }

    const cut = cutTeam(rest.trimStart());
    const name = cut.rest.trim();
    if (name === '') {
        return null;
    }

    return {type, team: cut.team, name, key: toKey(name), raw};
}

function emojiById(entries, id) {
    const entry = entries.find((item) => item.id === id);
    return entry ? entry.emoji : '';
}

// Builds a display string for data that came without one (vhack.info)
function formatNpc({type, team, name, level}) {
    const levelPart = level === null || typeof(level) === 'undefined' ? '' : ` (${level})`;
    return emojiById(npcTypes, type) + emojiById(teams, team) + name + levelPart;
}

function formatService({type, team, name}) {
    return emojiById(serviceTypes, type) + emojiById(teams, team) + name;
}

function npcTypeEmoji(type) {
    return emojiById(npcTypes, type);
}

function toKey(name) {
    return name.trim().toLowerCase();
}

// Keys to look up a user-typed name: as an NPC, as a service and as a bare name
function lookupKeys(input) {
    const text = input.trim();
    const npc = parseNpc(text);
    const service = parseService(text);
    const bare = toKey(text.replace(LEVEL, ''));

    return {
        npc: npc !== null ? npc.key : bare,
        service: service !== null ? service.key : bare,
    };
}

module.exports = {
    parseNpc,
    parseService,
    formatNpc,
    formatService,
    npcTypeEmoji,
    toKey,
    lookupKeys,
};
