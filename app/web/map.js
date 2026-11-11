const path = require('path');

// GET /map/<token>: a snapshot of the chat's subnet for the current game day, drawn as a graph
// by app/web/public/map-page.js (Cytoscape.js + fcose layout, served from node_modules by us).
// Access: the token (app/service/mapLink.js) names the chat; subnet and day are resolved here,
// at opening time, never taken from the URL. Only devices and links are shown for now.
module.exports = function(app) {
    const assets = {
        'cytoscape.min.js': require.resolve('cytoscape/dist/cytoscape.min.js'),
        'layout-base.js': require.resolve('layout-base/layout-base.js'),
        'cose-base.js': require.resolve('cose-base/cose-base.js'),
        'cytoscape-fcose.js': require.resolve('cytoscape-fcose/cytoscape-fcose.js'),
        'map-page.js': path.join(__dirname, 'public', 'map-page.js'),
    };

    // Scripts only, no data: safe to cache and to serve without a token
    app.http.get('/map-assets/:name', (req, res) => {
        const file = assets[req.params.name];
        if (typeof(file) === 'undefined') {
            res.status(404).end();
            return;
        }

        res.set({'Cache-Control': 'public, max-age=3600', 'X-Content-Type-Options': 'nosniff'});
        res.type('application/javascript').sendFile(file);
    });

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

        send(res, 200, renderMap({subnetCode: subnet.code, day, links, generatedAt: new Date()}));
    }

    function sendMessage(res, status, message) {
        send(res, status, renderPage('Карта подсети', `<main class="message"><p>${escape(message)}</p></main>`));
    }

    function send(res, status, html) {
        res.status(status);
        res.set({
            'Content-Type': 'text/html; charset=utf-8',
            // The token is in the URL: don't cache it or leak it to anything the page links to
            'Cache-Control': 'no-store',
            'Referrer-Policy': 'no-referrer',
            'X-Robots-Tag': 'noindex, nofollow',
            'X-Content-Type-Options': 'nosniff',
            'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
        });
        res.send(html);
    }
};

// Graph for the page: devices seen today and links between them.
// A→B and B→A become one mutual edge: a link known from one side only keeps its arrow.
function buildGraph(links) {
    const sources = new Set(links.map((link) => link.source));
    const devices = new Set(links.flatMap((link) => [link.source, link.target]));
    const directed = new Set(links.filter((link) => link.source !== link.target).map((link) => link.source + '>' + link.target));

    const nodes = [...devices].sort().map((code) => ({id: code, state: sources.has(code) ? 'explored' : 'seen'}));
    const edges = [];
    for (const key of [...directed].sort()) {
        const [source, target] = key.split('>');
        const mutual = directed.has(target + '>' + source);
        if (mutual && source > target) {
            continue;
        }
        edges.push({source, target, mutual});
    }

    return {nodes, edges};
}

function renderMap({subnetCode, day, links, generatedAt}) {
    const graph = buildGraph(links);
    const explored = graph.nodes.filter((node) => node.state === 'explored').length;
    const time = generatedAt.toLocaleString('ru-RU', {day: 'numeric', month: 'numeric', hour: 'numeric', minute: 'numeric'});
    // Same seed for the same subnet and day: reopening the map keeps the picture familiar
    const data = {seed: `${subnetCode}:${day}`, ...graph};

    const body = `
<header>
  <div class="title">
    <h1>Подсеть ${escape(subnetCode)}</h1>
    <p class="meta">Снимок на ${escape(time)} · исследовано ${explored} из ${graph.nodes.length} · связей ${graph.edges.length}</p>
  </div>
  <form id="search" class="search" autocomplete="off">
    <input id="search-code" type="text" inputmode="text" maxlength="8" placeholder="Код, например A7" aria-label="Найти устройство">
    <button type="submit">Найти</button>
    <button type="button" id="fit">Весь граф</button>
  </form>
  <ul class="legend">
    <li><span class="dot explored"></span>исследовано</li>
    <li><span class="dot seen"></span>видели только как связь</li>
    <li><span class="line"></span>связь в обе стороны</li>
    <li><span class="line oneway"></span>известна с одной стороны</li>
  </ul>
  <p id="info" class="info">Нажми на устройство, чтобы выделить его соседей.</p>
</header>
<main id="graph" aria-label="Граф устройств подсети ${escape(subnetCode)}"></main>
${graph.nodes.length === 0 ? '<p class="empty">За этот игровой день связей ещё нет.</p>' : ''}
<script type="application/json" id="graph-data">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>
<script src="/map-assets/cytoscape.min.js"></script>
<script src="/map-assets/layout-base.js"></script>
<script src="/map-assets/cose-base.js"></script>
<script src="/map-assets/cytoscape-fcose.js"></script>
<script src="/map-assets/map-page.js"></script>`;

    return renderPage(`Подсеть ${subnetCode}`, body);
}

function renderPage(title, body) {
    return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<title>${escape(title)}</title>
<style>
:root {
  --bg: #f6f6f3; --surface: #ffffff; --fg: #1d1d1f; --muted: #6b6b70; --border: #dcdcd6;
  --edge: #a9a9b2; --accent: #1f6feb;
  --explored: #2f7d4f; --seen: #b7801a; --label: #ffffff;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #141416; --surface: #1d1d20; --fg: #ececec; --muted: #9a9aa0; --border: #34343a;
    --edge: #5c5c66; --accent: #5aa2ff;
    --explored: #45a96f; --seen: #d8a23a; --label: #141416;
  }
}
:root[data-theme="dark"] {
  --bg: #141416; --surface: #1d1d20; --fg: #ececec; --muted: #9a9aa0; --border: #34343a;
  --edge: #5c5c66; --accent: #5aa2ff;
  --explored: #45a96f; --seen: #d8a23a; --label: #141416;
}
* { box-sizing: border-box; }
html, body { height: 100%; }
body { margin: 0; overflow: hidden; display: flex; flex-direction: column; background: var(--bg); color: var(--fg); font: 15px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif; }
header { padding: 12px 16px 8px; border-bottom: 1px solid var(--border); display: flex; flex-wrap: wrap; gap: 6px 24px; align-items: flex-end; }
.title { flex: 1 1 260px; }
h1 { margin: 0; font-size: 20px; }
.meta { margin: 2px 0 0; color: var(--muted); font-size: 14px; }
.search { display: flex; flex-wrap: wrap; gap: 6px; flex: 0 1 auto; min-width: 0; }
.search input, .search button { font: inherit; font-size: 14px; padding: 5px 10px; border-radius: 6px; border: 1px solid var(--border); background: var(--surface); color: var(--fg); }
.search input { width: 140px; min-width: 0; flex: 1 1 100px; text-transform: uppercase; }
.search input::placeholder { text-transform: none; }
.search button { cursor: pointer; }
.search input.miss { border-color: #d4520c; }
.legend { flex-basis: 100%; display: flex; flex-wrap: wrap; gap: 2px 16px; margin: 0; padding: 0; list-style: none; color: var(--muted); font-size: 13px; }
.legend li { display: flex; align-items: center; gap: 6px; }
.dot { width: 11px; height: 11px; border-radius: 50%; }
.dot.explored { background: var(--explored); }
.dot.seen { background: var(--seen); }
.line { width: 22px; border-top: 2px solid var(--edge); }
.line.oneway { border-top-style: dashed; }
.info { flex-basis: 100%; margin: 0; min-height: 1.4em; font-size: 14px; font-variant-numeric: tabular-nums; }
#graph { flex: 1; min-height: 0; width: 100%; overflow: hidden; }
.empty { position: absolute; top: 50%; left: 0; right: 0; text-align: center; color: var(--muted); }
.message { margin: auto; padding: 16px; text-align: center; font-size: 17px; }
</style>
</head>
<body>
${body}
</body>
</html>`;
}

function escape(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[char]);
}

module.exports.renderMap = renderMap;
module.exports.buildGraph = buildGraph;
