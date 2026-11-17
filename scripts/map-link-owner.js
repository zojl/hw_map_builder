// Who requested a /map link: node scripts/map-link-owner.js <link or token>
require('dotenv').config();
const mapLink = require('../app/service/mapLink.js');

const input = process.argv[2];
if (!input) {
    console.log('Usage: node scripts/map-link-owner.js <link or token>');
    process.exit(1);
}

const token = input.split('/').pop().split(/[?#]/)[0];
const link = mapLink.decode(token);
if (link === null) {
    console.log('Not a map link');
    process.exit(1);
}

const {status} = mapLink.verify(token);
console.log(`Chat id:   ${link.chatId} (chats.id, not peerId)`);
console.log(`VK user:   https://vk.com/id${link.userId}`);
console.log(`Expires:   ${link.expiresAt.toLocaleString('ru-RU')}`);
console.log(`Signature: ${status === 'invalid' ? 'INVALID (forged, or signed with another MAP_LINK_SECRET)' : 'valid'}`);
