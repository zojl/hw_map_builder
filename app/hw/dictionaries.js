// Game dictionaries. Ids match vhack.info API codes.
// To support a new NPC type, service type or team, add one line here.
// Write emoji the way they should be displayed: the parser matches them
// with or without the U+FE0F variation selector.
module.exports = {
    npcTypes: [
        {id: 10, emoji: '🔰', title: 'сисадмин'},
        {id: 9,  emoji: '📊', title: 'информатор'},
        {id: 8,  emoji: '🛂', title: 'инспектор'},
        {id: 7,  emoji: '🚸', title: 'нарушитель'},
        {id: 6,  emoji: '🤖', title: 'ботнет'},
        {id: 5,  emoji: '🚨', title: 'наёмник'},
        {id: 4,  emoji: '🎯', title: 'отслеживаемый'},
        {id: 3,  emoji: '⚖', title: 'торговец'},
        {id: 2,  emoji: '⚔', title: 'босс (старый)'},
        {id: 1,  emoji: '👀', title: 'наблюдатель'},
    ],

    serviceTypes: [
        {id: 1, emoji: '🧿'},
        {id: 2, emoji: '☣️'},
        {id: 3, emoji: '⚠️'},
    ],

    teams: [
        {id: 1, emoji: '💠', title: 'Aegis'},
        {id: 2, emoji: '🚧', title: 'V-hack'},
        {id: 3, emoji: '🎭', title: 'Phantoms'},
        {id: 4, emoji: '🈵', title: 'Huǒqiáng'},
        {id: 5, emoji: '🔱', title: 'NetKings'},
        {id: 6, emoji: '🇺🇸', title: 'NHS'},
        {id: 8, emoji: '💣', title: 'H4rdF0rk'},
        {id: 9, emoji: '🧭', title: 'Const4nt'},
    ],

    // vhack.info codes for "unknown"
    unknownServiceType: 0,
    unknownTeam: -1,
};
