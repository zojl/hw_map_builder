// Draws the subnet graph embedded by app/web/map.js. Globals come from the scripts loaded before:
// cytoscape, and the fcose layout that registers itself in it.
(function() {
    const data = JSON.parse(document.getElementById('graph-data').textContent);
    const container = document.getElementById('graph');
    const info = document.getElementById('info');
    const defaultInfo = info.textContent;
    if (data.nodes.length === 0) {
        return;
    }

    const stateNames = {explored: 'исследовано', seen: 'видели только как связь'};

    function palette() {
        const css = getComputedStyle(document.documentElement);
        const get = (name) => css.getPropertyValue(name).trim();
        return {
            bg: get('--bg'), fg: get('--fg'), edge: get('--edge'), accent: get('--accent'),
            explored: get('--explored'), seen: get('--seen'), label: get('--label'),
        };
    }

    function style() {
        const c = palette();
        return [
            {selector: 'node', style: {
                'width': 28, 'height': 28, 'label': 'data(id)',
                'font-family': 'ui-monospace, SFMono-Regular, Menlo, monospace', 'font-size': 10, 'font-weight': 600,
                'color': c.label, 'text-valign': 'center', 'text-halign': 'center',
                'border-width': 2, 'border-color': c.bg,
            }},
            {selector: 'node[state = "explored"]', style: {'background-color': c.explored}},
            {selector: 'node[state = "seen"]', style: {'background-color': c.seen}},
            {selector: 'edge', style: {
                'width': 1.5, 'line-color': c.edge, 'curve-style': 'straight',
            }},
            {selector: 'edge[!mutual]', style: {
                'line-style': 'dashed', 'line-dash-pattern': [5, 4],
                'target-arrow-shape': 'triangle', 'target-arrow-color': c.edge, 'arrow-scale': 0.9,
            }},
            {selector: '.faded', style: {'opacity': 0.12}},
            {selector: 'node.focus', style: {'border-color': c.accent, 'border-width': 3}},
            {selector: 'edge.near', style: {'line-color': c.accent, 'target-arrow-color': c.accent, 'width': 2.5}},
        ];
    }

    // Seeded Math.random during the layout: the same subnet and day give the same picture
    function seededRandom(seed) {
        let h = 1779033703 ^ seed.length;
        for (let i = 0; i < seed.length; i++) {
            h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
            h = (h << 13) | (h >>> 19);
        }
        return function() {
            h = (h + 0x6D2B79F5) | 0;
            let t = Math.imul(h ^ (h >>> 15), 1 | h);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    const cy = cytoscape({
        container,
        elements: [
            ...data.nodes.map((node) => ({group: 'nodes', data: node})),
            ...data.edges.map((edge) => ({group: 'edges', data: {...edge, id: edge.source + '-' + edge.target}})),
        ],
        style: style(),
        minZoom: 0.15,
        maxZoom: 4,
        boxSelectionEnabled: false,
        autoungrabify: false,
    });

    const random = Math.random;
    Math.random = seededRandom(data.seed);
    try {
        cy.layout({
            name: 'fcose',
            quality: 'proof',
            randomize: true,
            animate: false,
            nodeRepulsion: 9000,
            idealEdgeLength: 70,
            edgeElasticity: 0.3,
            gravity: 0.2,
            nodeSeparation: 60,
            padding: 24,
        }).run();
    } finally {
        Math.random = random;
    }

    function reset() {
        cy.elements().removeClass('faded focus near');
        info.textContent = defaultInfo;
    }

    function list(codes) {
        return codes.length > 0 ? codes.sort().join(', ') : '—';
    }

    function focus(node) {
        reset();
        const code = node.id();
        const edges = node.connectedEdges();
        cy.elements().addClass('faded');
        node.closedNeighborhood().removeClass('faded');
        node.addClass('focus');
        edges.addClass('near');

        const both = [];
        const outgoing = [];
        const incoming = [];
        edges.forEach((edge) => {
            const other = edge.source().id() === code ? edge.target().id() : edge.source().id();
            if (edge.data('mutual')) {
                both.push(other);
            } else if (edge.source().id() === code) {
                outgoing.push(other);
            } else {
                incoming.push(other);
            }
        });

        let text = `📟${code} (${stateNames[node.data('state')]}) · связи: ${list(both)}`;
        if (outgoing.length > 0) {
            text += ` · только туда: ${list(outgoing)}`;
        }
        if (incoming.length > 0) {
            text += ` · только оттуда: ${list(incoming)}`;
        }
        info.textContent = text;
    }

    cy.on('tap', 'node', (event) => {
        if (event.target.hasClass('focus')) {
            reset();
        } else {
            focus(event.target);
        }
    });

    cy.on('tap', (event) => {
        if (event.target === cy) {
            reset();
        }
    });

    const searchInput = document.getElementById('search-code');
    document.getElementById('search').addEventListener('submit', (event) => {
        event.preventDefault();
        const raw = searchInput.value.trim().toUpperCase();
        const code = raw.length === 1 ? '0' + raw : raw.slice(-2);
        const node = /^[0-9A-F]{2}$/.test(code) ? cy.getElementById(code) : cy.collection();
        searchInput.classList.toggle('miss', node.empty());
        if (node.empty()) {
            return;
        }

        focus(node);
        cy.animate({center: {eles: node}, zoom: Math.max(cy.zoom(), 1.4)}, {duration: 300});
    });

    searchInput.addEventListener('input', () => searchInput.classList.remove('miss'));

    document.getElementById('fit').addEventListener('click', () => {
        reset();
        userMoved = false;
        cy.animate({fit: {eles: cy.elements(), padding: 24}}, {duration: 300});
    });

    // Keep the whole graph in view when the screen changes (phone rotation), until the user zooms or pans
    let userMoved = false;
    cy.on('scrollzoom pinchzoom dragpan', () => {
        userMoved = true;
    });
    window.addEventListener('resize', () => {
        cy.resize();
        if (!userMoved) {
            cy.fit(cy.elements(), 24);
        }
    });

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => cy.style(style()));
})();
