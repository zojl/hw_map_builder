// 3D view of the subnet map. Bundled by `npm run build` into app/web/public/build/map3d.js
// and loaded by map-page.js only when the 3D mode is opened: three.js is heavy.
// Same interface as the 2D view in map-page.js: {show, hide, focus, reset, fit, setTheme}.
import ForceGraph3D from '3d-force-graph';
import SpriteText from 'three-spritetext';

window.createMap3d = function(container, data, {onSelect, palette}) {
    let selected = null;
    let near = new Set();
    let fitted = false;
    let colors = palette();

    // Copies: the library replaces link ends with node objects
    const graph = {
        nodes: data.nodes.map((node) => ({...node, range: node.id[0]})),
        links: data.edges.map((edge) => ({...edge})),
    };
    const linkEnd = (end) => (typeof end === 'object' ? end.id : end);

    // Colour by range: devices of one range stay together and are easy to tell apart
    const rangeColor = (range) => `hsl(${(parseInt(range, 16) * 67) % 360}, 55%, 40%)`;

    const g = ForceGraph3D()(container)
        .graphData(graph)
        .backgroundColor(colors.bg)
        .showNavInfo(false)
        .nodeLabel(() => '')
        .nodeThreeObject((node) => {
            const sprite = new SpriteText(node.id);
            sprite.textHeight = 6;
            sprite.color = '#ffffff';
            sprite.fontWeight = '600';
            sprite.backgroundColor = rangeColor(node.range);
            sprite.padding = 2;
            sprite.borderRadius = 3;
            sprite.material.transparent = true;
            node.sprite = sprite;
            return sprite;
        })
        // Opacity comes from the colours below (the library's default 0.2 would pale the highlight too)
        .linkOpacity(1)
        .linkColor(linkColor)
        .linkWidth((link) => (isNear(link) ? 0.8 : 0))
        .linkDirectionalArrowLength((link) => (link.mutual ? 0 : 4))
        .linkDirectionalArrowRelPos(0.85)
        .linkDirectionalArrowColor(linkColor)
        .warmupTicks(60)
        .cooldownTicks(300)
        .onEngineStop(() => {
            if (!fitted) {
                fitted = true;
                g.zoomToFit(400, 40);
            }
        })
        .onNodeClick((node) => onSelect(node.id === selected ? null : node.id))
        .onBackgroundClick(() => onSelect(null));

    applyOpacity();

    function isNear(link) {
        return selected !== null && (linkEnd(link.source) === selected || linkEnd(link.target) === selected);
    }

    function linkColor(link) {
        if (isNear(link)) {
            return colors.accent;
        }
        const alpha = selected === null ? 0.3 : 0.05;
        return link.mutual ? `rgba(160, 160, 175, ${alpha})` : `rgba(240, 150, 60, ${alpha})`;
    }

    // Devices seen only as a link target are pale; with a selection, everything else fades
    function applyOpacity() {
        for (const node of graph.nodes) {
            if (!node.sprite) {
                continue;
            }
            const base = node.state === 'seen' ? 0.55 : 1;
            const focused = selected === null || node.id === selected || near.has(node.id);
            node.sprite.material.opacity = focused ? base : 0.12;
        }
    }

    function refresh() {
        applyOpacity();
        g.linkColor(linkColor).linkDirectionalArrowColor(linkColor).linkWidth(g.linkWidth());
    }

    function resize() {
        g.width(container.clientWidth).height(container.clientHeight);
    }

    window.addEventListener('resize', resize);

    return {
        show() {
            resize();
            g.resumeAnimation();
        },
        hide() {
            g.pauseAnimation();
        },
        reset() {
            selected = null;
            near = new Set();
            refresh();
        },
        focus(code, moveCamera) {
            const node = graph.nodes.find((item) => item.id === code);
            if (!node) {
                return;
            }
            selected = code;
            near = new Set();
            for (const link of graph.links) {
                if (linkEnd(link.source) === code) near.add(linkEnd(link.target));
                if (linkEnd(link.target) === code) near.add(linkEnd(link.source));
            }
            refresh();

            // Show the device together with its neighbours, not the device alone filling the screen
            if (moveCamera) {
                g.zoomToFit(600, 60, (item) => item.id === code || near.has(item.id));
            }
        },
        fit() {
            g.zoomToFit(500, 40);
        },
        setTheme() {
            colors = palette();
            g.backgroundColor(colors.bg);
            refresh();
        },
    };
};
