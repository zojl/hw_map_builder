// Draws the subnet graph embedded by app/web/map.js, in 2D or 3D.
// 2D: cytoscape + stressLayout (stress-layout.js), loaded with the page.
// 3D: window.createMap3d from /map-assets/map3d.js (app/web/client/map3d.mjs), loaded on first use.
// Both views share one interface: {show, hide, focus(code, moveCamera), reset, fit, setTheme}.
(function() {
    const data = JSON.parse(document.getElementById('graph-data').textContent);
    const info = document.getElementById('info');
    const defaultInfo = {
        '2d': 'Нажми на устройство, чтобы выделить его соседей.',
        '3d': 'Крути граф мышью или пальцем, нажми на устройство, чтобы выделить его соседей.',
    };
    const containers = {'2d': document.getElementById('graph'), '3d': document.getElementById('graph3d')};
    const modeButtons = document.querySelectorAll('[data-mode-button]');
    const stateNames = {explored: 'исследовано', seen: 'видели только как связь'};
    const states = new Map(data.nodes.map((node) => [node.id, node.state]));

    const views = {};
    let mode = null;
    let selected = null;

    function palette() {
        const css = getComputedStyle(document.documentElement);
        const get = (name) => css.getPropertyValue(name).trim();
        return {
            bg: get('--bg'), fg: get('--fg'), edge: get('--edge'), accent: get('--accent'),
            explored: get('--explored'), seen: get('--seen'), label: get('--label'),
        };
    }

    function list(codes) {
        return codes.length > 0 ? codes.sort().join(', ') : '—';
    }

    function describe(code) {
        const both = [];
        const outgoing = [];
        const incoming = [];
        for (const edge of data.edges) {
            if (edge.source !== code && edge.target !== code) {
                continue;
            }
            const other = edge.source === code ? edge.target : edge.source;
            if (edge.mutual) {
                both.push(other);
            } else if (edge.source === code) {
                outgoing.push(other);
            } else {
                incoming.push(other);
            }
        }

        let text = `📟${code} (${stateNames[states.get(code)]}) · связи: ${list(both)}`;
        if (outgoing.length > 0) {
            text += ` · только туда: ${list(outgoing)}`;
        }
        if (incoming.length > 0) {
            text += ` · только оттуда: ${list(incoming)}`;
        }
        return text;
    }

    // Selection is shared: it survives switching between 2D and 3D
    function select(code, moveCamera) {
        selected = code;
        const view = views[mode];
        if (code === null) {
            view.reset();
            info.textContent = defaultInfo[mode];
            return;
        }
        view.focus(code, moveCamera);
        info.textContent = describe(code);
    }

    function create2d(container) {
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

        // Positions from stress-layout.js: deterministic, so reopening the map gives the same picture
        const positions = stressLayout(
            data.nodes.map((node) => node.id),
            data.edges.map((edge) => [edge.source, edge.target]),
            80
        );

        const cy = cytoscape({
            container,
            elements: [
                ...data.nodes.map((node) => ({group: 'nodes', data: node})),
                ...data.edges.map((edge) => ({group: 'edges', data: {...edge, id: edge.source + '-' + edge.target}})),
            ],
            style: style(),
            layout: {name: 'preset', positions: (node) => positions[node.id()], fit: true, padding: 24},
            minZoom: 0.15,
            maxZoom: 4,
            boxSelectionEnabled: false,
        });

        cy.on('tap', 'node', (event) => select(event.target.id() === selected ? null : event.target.id(), false));
        cy.on('tap', (event) => {
            if (event.target === cy) {
                select(null);
            }
        });

        // Keep the whole graph in view when the screen changes (phone rotation), until the user zooms or pans
        let userMoved = false;
        cy.on('scrollzoom pinchzoom dragpan', () => {
            userMoved = true;
        });
        const refit = () => {
            cy.resize();
            if (!userMoved) {
                cy.fit(cy.elements(), 24);
            }
        };
        window.addEventListener('resize', () => {
            if (mode === '2d') {
                refit();
            }
        });

        return {
            show: refit,
            hide() {},
            reset() {
                cy.elements().removeClass('faded focus near');
            },
            focus(code, moveCamera) {
                const node = cy.getElementById(code);
                cy.elements().removeClass('faded focus near');
                cy.elements().addClass('faded');
                node.closedNeighborhood().removeClass('faded');
                node.addClass('focus');
                node.connectedEdges().addClass('near');
                if (moveCamera) {
                    cy.animate({center: {eles: node}, zoom: Math.max(cy.zoom(), 1.4)}, {duration: 300});
                }
            },
            fit() {
                userMoved = false;
                cy.animate({fit: {eles: cy.elements(), padding: 24}}, {duration: 300});
            },
            setTheme() {
                cy.style(style());
            },
        };
    }

    let loading3d = null;
    function load3d() {
        if (loading3d === null) {
            loading3d = new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = '/map-assets/map3d.js';
                script.onload = () => (typeof window.createMap3d === 'function' ? resolve() : reject(new Error('no createMap3d')));
                script.onerror = () => reject(new Error('load failed'));
                document.head.appendChild(script);
            });
            loading3d.catch(() => {
                loading3d = null;
            });
        }
        return loading3d;
    }

    async function setMode(next) {
        if (next === mode) {
            return;
        }

        if (!views[next]) {
            if (next === '3d') {
                info.textContent = 'Загружаю 3D…';
                try {
                    await load3d();
                } catch (error) {
                    info.textContent = 'Не удалось загрузить 3D-режим.';
                    return;
                }
                containers['3d'].hidden = false;
                views['3d'] = window.createMap3d(containers['3d'], data, {
                    onSelect: (code) => select(code, false),
                    palette,
                });
            } else {
                containers['2d'].hidden = false;
                views['2d'] = create2d(containers['2d']);
            }
        }

        if (mode !== null) {
            views[mode].hide();
            containers[mode].hidden = true;
        }
        mode = next;
        containers[mode].hidden = false;
        document.body.dataset.mode = mode;
        modeButtons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.modeButton === mode)));
        views[mode].show();
        select(selected, selected !== null);

        try {
            localStorage.setItem('map-mode', mode);
        } catch (error) {
            // Private mode or blocked storage: the choice just isn't remembered
        }
    }

    if (data.nodes.length === 0) {
        return;
    }

    modeButtons.forEach((button) => button.addEventListener('click', () => setMode(button.dataset.modeButton)));

    const searchInput = document.getElementById('search-code');
    document.getElementById('search').addEventListener('submit', (event) => {
        event.preventDefault();
        const raw = searchInput.value.trim().toUpperCase();
        const code = raw.length === 1 ? '0' + raw : raw.slice(-2);
        const found = /^[0-9A-F]{2}$/.test(code) && states.has(code);
        searchInput.classList.toggle('miss', !found);
        if (found && mode !== null) {
            select(code, true);
        }
    });
    searchInput.addEventListener('input', () => searchInput.classList.remove('miss'));

    document.getElementById('fit').addEventListener('click', () => {
        if (mode !== null) {
            select(null);
            views[mode].fit();
        }
    });

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        Object.values(views).forEach((view) => view.setTheme());
    });

    let saved = null;
    try {
        saved = localStorage.getItem('map-mode');
    } catch (error) {
        saved = null;
    }
    // 2D always comes first: it is light, and 3D may fail to load
    setMode('2d').then(() => {
        if (saved === '3d') {
            setMode('3d');
        }
    });
})();
