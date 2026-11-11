// Recognizes a rectangular grid in an undirected graph: every device linked exactly to its
// neighbours left, right, above and below, and to nothing else.
//
// findGrid(codes, links: [[a, b]]) →
//   {ok: true, rows: [[code, …], …]}
//   {ok: false, reason, codes?} — reason: 'empty' | 'isolated' | 'disconnected' | 'degree' | 'shape'
//
// How: in an r×c grid, hops from the corner (0,0) are i + j, and from the corner (0,c-1) they are
// i + (c-1-j). So two corners give every device its coordinates. Each candidate is then checked
// against the links exactly, so a wrong guess can never be returned.
module.exports = {findGrid};

function findGrid(codes, links) {
    const n = codes.length;
    const neighbours = new Map(codes.map((code) => [code, new Set()]));
    for (const [a, b] of links) {
        if (a !== b && neighbours.has(a) && neighbours.has(b)) {
            neighbours.get(a).add(b);
            neighbours.get(b).add(a);
        }
    }

    if (n < 2 || [...neighbours.values()].every((set) => set.size === 0)) {
        return {ok: false, reason: 'empty'};
    }

    const isolated = codes.filter((code) => neighbours.get(code).size === 0);
    if (isolated.length > 0) {
        return {ok: false, reason: 'isolated', codes: isolated};
    }

    const tooMany = codes.filter((code) => neighbours.get(code).size > 4);
    if (tooMany.length > 0) {
        return {ok: false, reason: 'degree', codes: tooMany};
    }

    const distances = new Map();
    const distancesFrom = (code) => {
        if (!distances.has(code)) {
            distances.set(code, bfs(code, neighbours));
        }
        return distances.get(code);
    };

    const fromFirst = distancesFrom(codes[0]);
    if (fromFirst.size !== n) {
        return {ok: false, reason: 'disconnected', codes: codes.filter((code) => !fromFirst.has(code))};
    }

    // Corners have 2 links and a grid has 4 of them. A single row has 2 ends with 1 link instead.
    const ends = codes.filter((code) => neighbours.get(code).size === 1);
    const corners = ends.length > 0 ? ends : codes.filter((code) => neighbours.get(code).size === 2);
    if (corners.length !== 2 && corners.length !== 4) {
        return {ok: false, reason: 'shape'};
    }

    let best = null;
    for (const first of corners) {
        const fromCorner = distancesFrom(first);
        for (const second of corners) {
            if (second === first) {
                continue;
            }

            const rows = place(codes, neighbours, fromCorner, distancesFrom(second), fromCorner.get(second) + 1);
            if (rows !== null && (best === null || compare(rows, best) < 0)) {
                best = rows;
            }
        }
    }

    return best === null ? {ok: false, reason: 'shape'} : {ok: true, rows: best};
}

// Coordinates from two corners of the same row, `width` devices apart; null unless it is exactly a grid
function place(codes, neighbours, fromCorner, fromOther, width) {
    const n = codes.length;
    if (n % width !== 0) {
        return null;
    }

    const height = n / width;
    const rows = Array.from({length: height}, () => new Array(width).fill(null));
    const positions = new Map();
    for (const code of codes) {
        const sum = fromCorner.get(code) + fromOther.get(code) - (width - 1);
        const diff = fromCorner.get(code) - fromOther.get(code) + (width - 1);
        if (sum % 2 !== 0 || diff % 2 !== 0) {
            return null;
        }

        const i = sum / 2;
        const j = diff / 2;
        if (i < 0 || i >= height || j < 0 || j >= width || rows[i][j] !== null) {
            return null;
        }
        rows[i][j] = code;
        positions.set(code, [i, j]);
    }

    for (const code of codes) {
        const [i, j] = positions.get(code);
        const expected = [[i - 1, j], [i + 1, j], [i, j - 1], [i, j + 1]]
            .filter(([y, x]) => y >= 0 && y < height && x >= 0 && x < width)
            .map(([y, x]) => rows[y][x]);
        const actual = neighbours.get(code);
        if (expected.length !== actual.size || expected.some((other) => !actual.has(other))) {
            return null;
        }
    }

    return rows;
}

function bfs(start, neighbours) {
    const distance = new Map([[start, 0]]);
    const queue = [start];
    for (let head = 0; head < queue.length; head++) {
        const code = queue[head];
        for (const next of neighbours.get(code)) {
            if (!distance.has(next)) {
                distance.set(next, distance.get(code) + 1);
                queue.push(next);
            }
        }
    }
    return distance;
}

// The same grid can be rotated and mirrored 8 ways: pick one predictably.
// Wider rather than taller (fits a chat message), then the smallest codes first.
function compare(a, b) {
    if (a.length !== b.length) {
        return a.length - b.length;
    }
    const flatA = a.flat().join(' ');
    const flatB = b.flat().join(' ');
    return flatA < flatB ? -1 : flatA > flatB ? 1 : 0;
}
