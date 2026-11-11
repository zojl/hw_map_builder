const crypto = require('crypto');

// GET /map/<token>: a static snapshot of the chat's subnet for the current game day.
// Access: the token (app/service/mapLink.js) names the chat; subnet and day are resolved here,
// at opening time, never taken from the URL. Only devices and links are shown for now.
module.exports = function(app) {
    app.http.get('/map/:token', async (req, res) => {
        try {
            await handleMap(req, res);
        } catch (error) {
            console.error('Map page failed:', error);
            app.sentry.captureException(error);
            sendMessage(res, 500, 'Не удалось построить карту, попробуй позже.');
        }
    });

    async function handleMap(req, res) {
        const {status, link} = app.service.mapLink.verify(req.params.token);
        if (status === 'expired') {
            sendMessage(res, 410, 'Ссылка устарела. Запроси новую командой /map в чате.');
            return;
        }

        const chat = status === 'ok' ? await app.model.chats.findOne({where: {id: link.chatId}}) : null;
        const subnet = chat === null ? null : await app.repository.subnet.getOneById(chat.subnet);
        if (subnet === null) {
            sendMessage(res, 404, 'Ссылка недействительна.');
            return;
        }

        console.log(`Map of subnet ${subnet.code} opened by link of chat ${chat.id} (peer ${chat.peerId}), user ${link.userId}, from ${req.ip} ${req.get('x-forwarded-for') || ''}`);

        const day = app.getDates().day;
        const connections = await app.repository.connection.getAllByDayAndSubnet(day, subnet.id);
        const deviceIds = [...new Set(connections.flatMap((connection) => [connection.source, connection.target]))];
        const codes = deviceIds.length > 0 ? await app.repository.device.getCodesByIds(deviceIds) : {};

        const links = connections
            .filter((connection) => codes[connection.source] && codes[connection.target])
            .map((connection) => ({source: codes[connection.source], target: codes[connection.target]}));

        send(res, 200, renderMap({subnetCode: subnet.code, links, generatedAt: new Date()}));
    }

    function sendMessage(res, status, message) {
        send(res, status, renderPage('Карта подсети', `<main class="message"><p>${escape(message)}</p></main>`, ''));
    }

    function send(res, status, {html, nonce}) {
        res.status(status);
        res.set({
            'Content-Type': 'text/html; charset=utf-8',
            // The token is in the URL: don't cache it or leak it to anything the page links to
            'Cache-Control': 'no-store',
            'Referrer-Policy': 'no-referrer',
            'X-Robots-Tag': 'noindex, nofollow',
            'X-Content-Type-Options': 'nosniff',
            'Content-Security-Policy': `default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
        });
        res.send(html);
    }
};

const cell = 40;
const radius = 13;
const margin = 26;
const size = margin + 16 * cell + 6;

// Devices sit on a 16×16 grid by their code: A7 is row A, column 7. Positions are the same every day.
function position(code) {
    const value = parseInt(code, 16);
    return {
        x: margin + (value % 16) * cell + cell / 2,
        y: margin + Math.floor(value / 16) * cell + cell / 2,
    };
}

function renderMap({subnetCode, links, generatedAt}) {
    const sources = new Set(links.map((link) => link.source));
    const targets = new Set(links.map((link) => link.target));

    const headers = [];
    for (let i = 0; i < 16; i++) {
        const digit = i.toString(16).toUpperCase();
        const center = margin + i * cell + cell / 2;
        headers.push(`<text class="axis" x="${center}" y="${margin - 9}">${digit}</text>`);
        headers.push(`<text class="axis" x="${margin - 12}" y="${center + 4}">${digit}</text>`);
    }

    const edges = [];
    const seen = new Set();
    for (const {source, target} of links) {
        const key = source + '>' + target;
        if (source === target || seen.has(key)) {
            continue;
        }
        seen.add(key);
        edges.push(`<path class="edge" data-s="${escape(source)}" data-t="${escape(target)}" d="${edgePath(position(source), position(target))}"/>`);
    }

    const nodes = [];
    let explored = 0;
    let found = 0;
    for (let value = 0; value < 256; value++) {
        const code = value.toString(16).toUpperCase().padStart(2, '0');
        const {x, y} = position(code);
        let state = 'unknown';
        let title = 'нет данных';
        if (sources.has(code)) {
            state = 'explored';
            title = 'исследовано';
            explored++;
        } else if (targets.has(code)) {
            state = 'seen';
            title = 'видели только как связь';
            found++;
        }

        nodes.push(`<g class="node ${state}" data-code="${code}"><title>${code}: ${title}</title>`
            + `<circle cx="${x}" cy="${y}" r="${radius}"/>`
            + `<text x="${x}" y="${y + 3.5}">${code}</text></g>`);
    }

    const time = generatedAt.toLocaleString('ru-RU', {day: 'numeric', month: 'numeric', hour: 'numeric', minute: 'numeric'});
    const markers = ['def', 'out', 'in'].map((kind) =>
        `<marker id="arrow-${kind}" class="arrow-${kind}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z"/></marker>`
    ).join('');

    const body = `
<header>
  <h1>Подсеть ${escape(subnetCode)}</h1>
  <p class="meta">Снимок на ${escape(time)} · исследовано ${explored} · видели ${found} · связей ${edges.length}</p>
  <ul class="legend">
    <li><span class="dot explored"></span>исследовано</li>
    <li><span class="dot seen"></span>видели только как связь</li>
    <li><span class="dot unknown"></span>нет данных</li>
  </ul>
</header>
<main>
  <p id="info" class="info">Нажми на устройство, чтобы выделить его связи.</p>
  <svg id="map" viewBox="0 0 ${size} ${size}" role="img" aria-label="Карта устройств подсети ${escape(subnetCode)}">
    <defs>${markers}</defs>
    <g class="axes">${headers.join('')}</g>
    <g class="edges">${edges.join('')}</g>
    <g class="nodes">${nodes.join('')}</g>
  </svg>
</main>`;

    return renderPage(`Подсеть ${subnetCode}`, body, script);
}

// A slight curve, so that A→B and B→A don't overlap and lines bend around nodes in between
function edgePath(from, to) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy);
    const bend = 0.15 * length;
    const control = {x: (from.x + to.x) / 2 - dy / length * bend, y: (from.y + to.y) / 2 + dx / length * bend};

    const start = moveTowards(from, control, radius);
    const end = moveTowards(to, control, radius + 1);
    return `M${round(start.x)},${round(start.y)} Q${round(control.x)},${round(control.y)} ${round(end.x)},${round(end.y)}`;
}

function moveTowards(point, towards, distance) {
    const dx = towards.x - point.x;
    const dy = towards.y - point.y;
    const length = Math.hypot(dx, dy) || 1;
    return {x: point.x + dx / length * distance, y: point.y + dy / length * distance};
}

function round(value) {
    return Math.round(value * 10) / 10;
}

// Click a device to highlight its links; click it again or the background to reset
const script = `
const svg = document.getElementById('map');
const info = document.getElementById('info');
const defaultInfo = info.textContent;
let selected = null;

function reset() {
  selected = null;
  svg.classList.remove('focus');
  svg.querySelectorAll('.out, .in, .near, .sel').forEach((el) => el.classList.remove('out', 'in', 'near', 'sel'));
  info.textContent = defaultInfo;
}

svg.addEventListener('click', (event) => {
  const node = event.target.closest('.node');
  const code = node ? node.dataset.code : null;
  if (code === null || code === selected) {
    reset();
    return;
  }

  reset();
  selected = code;
  svg.classList.add('focus');
  node.classList.add('sel');
  const outgoing = [];
  const incoming = [];
  svg.querySelectorAll('.edge').forEach((edge) => {
    if (edge.dataset.s === code) {
      edge.classList.add('out');
      outgoing.push(edge.dataset.t);
    } else if (edge.dataset.t === code) {
      edge.classList.add('in');
      incoming.push(edge.dataset.s);
    }
  });
  [...outgoing, ...incoming].forEach((other) => {
    const el = svg.querySelector('.node[data-code="' + other + '"]');
    if (el) el.classList.add('near');
  });

  const list = (codes) => codes.length > 0 ? codes.sort().join(', ') : 'нет';
  info.textContent = '📟' + code + ' → ' + list(outgoing) + ' · ← ' + list(incoming);
});
`;

function renderPage(title, body, pageScript) {
    const nonce = crypto.randomBytes(16).toString('base64');
    const html = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<title>${escape(title)}</title>
<style>
:root {
  --bg: #f6f6f3; --fg: #1d1d1f; --muted: #6b6b70; --axis: #9a9a9f;
  --edge: rgba(55, 55, 70, 0.26); --out: #1f6feb; --in: #d4520c;
  --explored: #2f7d4f; --seen: #b7801a; --unknown: #cfcfca; --label: #ffffff;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #141416; --fg: #ececec; --muted: #9a9aa0; --axis: #6a6a70;
    --edge: rgba(220, 220, 235, 0.2); --out: #5aa2ff; --in: #ff9a4d;
    --explored: #45a96f; --seen: #d8a23a; --unknown: #3a3a3f; --label: #141416;
  }
}
:root[data-theme="dark"] {
  --bg: #141416; --fg: #ececec; --muted: #9a9aa0; --axis: #6a6a70;
  --edge: rgba(220, 220, 235, 0.2); --out: #5aa2ff; --in: #ff9a4d;
  --explored: #45a96f; --seen: #d8a23a; --unknown: #3a3a3f; --label: #141416;
}
* { box-sizing: border-box; }
body { margin: 0; padding: 16px; background: var(--bg); color: var(--fg); font: 15px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif; }
header, main { max-width: 760px; margin: 0 auto; }
h1 { margin: 0 0 4px; font-size: 22px; }
.meta, .info { margin: 0 0 8px; color: var(--muted); }
.info { min-height: 1.4em; font-variant-numeric: tabular-nums; }
.legend { display: flex; flex-wrap: wrap; gap: 4px 16px; margin: 0 0 12px; padding: 0; list-style: none; color: var(--muted); font-size: 14px; }
.legend li { display: flex; align-items: center; gap: 6px; }
.dot { width: 12px; height: 12px; border-radius: 50%; }
.dot.explored { background: var(--explored); }
.dot.seen { background: var(--seen); }
.dot.unknown { border: 1.5px solid var(--unknown); }
.message { padding-top: 20vh; text-align: center; font-size: 17px; }
svg { display: block; width: 100%; height: auto; user-select: none; }
.axis { fill: var(--axis); font: 11px ui-monospace, monospace; text-anchor: middle; }
.edge { fill: none; stroke: var(--edge); stroke-width: 1.2; marker-end: url(#arrow-def); }
.arrow-def path { fill: var(--edge); }
.arrow-out path { fill: var(--out); }
.arrow-in path { fill: var(--in); }
.node { cursor: pointer; }
.node circle { stroke-width: 1.5; }
.node text { font: 600 10px ui-monospace, monospace; text-anchor: middle; pointer-events: none; }
.node.explored circle { fill: var(--explored); stroke: var(--explored); }
.node.seen circle { fill: var(--seen); stroke: var(--seen); }
.node.explored text, .node.seen text { fill: var(--label); }
.node.unknown circle { fill: var(--bg); stroke: var(--unknown); }
.node.unknown text { fill: var(--axis); font-weight: 400; }
svg.focus .edge { opacity: 0.08; }
svg.focus .edge.out { opacity: 1; stroke: var(--out); stroke-width: 2; marker-end: url(#arrow-out); }
svg.focus .edge.in { opacity: 1; stroke: var(--in); stroke-width: 2; marker-end: url(#arrow-in); }
svg.focus .node { opacity: 0.3; }
svg.focus .node.sel, svg.focus .node.near { opacity: 1; }
svg.focus .node.sel circle { stroke: var(--fg); stroke-width: 2.5; }
</style>
</head>
<body>
${body}
${pageScript ? `<script nonce="${nonce}">${pageScript}</script>` : ''}
</body>
</html>`;

    return {html, nonce};
}

function escape(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[char]);
}

module.exports.renderMap = renderMap;
