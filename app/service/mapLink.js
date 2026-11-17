const crypto = require('crypto');

// Signed links to the /map page. Stateless: nothing to store or clean up.
// The payload (chat, VK user, expiry) is readable on purpose: if a link leaks,
// scripts/map-link-owner.js tells who requested it. The signature only stops forging.
const ttlSeconds = 5 * 60;

module.exports = {
    ttlSeconds,
    isEnabled,
    create,
    decode,
    verify,
    url,
};

function getSecret() {
    return process.env.MAP_LINK_SECRET || '';
}

function isEnabled() {
    return getSecret() !== '' && (process.env.MAP_BASE_URL || '') !== '';
}

function url(token) {
    return process.env.MAP_BASE_URL.replace(/\/+$/, '') + '/map/' + token;
}

function sign(payload) {
    return crypto.createHmac('sha256', getSecret()).update(payload).digest('base64url');
}

function create(chatId, userId, now = Date.now()) {
    const data = {c: chatId, u: userId, e: Math.floor(now / 1000) + ttlSeconds};
    const payload = Buffer.from(JSON.stringify(data)).toString('base64url');
    return payload + '.' + sign(payload);
}

// Reads the payload without checking the signature
function decode(token) {
    const payload = String(token).split('.')[0];
    let data;
    try {
        data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    } catch (error) {
        return null;
    }

    if (data === null || !Number.isInteger(data.c) || !Number.isInteger(data.u) || !Number.isInteger(data.e)) {
        return null;
    }

    return {chatId: data.c, userId: data.u, expiresAt: new Date(data.e * 1000)};
}

// {status: 'ok' | 'expired' | 'invalid', link}
function verify(token, now = Date.now()) {
    const parts = String(token).split('.');
    if (parts.length !== 2 || getSecret() === '') {
        return {status: 'invalid', link: null};
    }

    const expected = Buffer.from(sign(parts[0]));
    const actual = Buffer.from(parts[1]);
    if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
        return {status: 'invalid', link: null};
    }

    const link = decode(token);
    if (link === null) {
        return {status: 'invalid', link: null};
    }

    if (link.expiresAt.getTime() <= now) {
        return {status: 'expired', link};
    }

    return {status: 'ok', link};
}
