// Recognizes a rectangular grid in an undirected graph: every device linked exactly to its
// neighbours left, right, above and below, and to nothing else. Edges may be glued together:
// rows closed into rings (a cylinder; a single row is just a ring) or rows and columns both (a torus).
//
// findGrid(codes, links: [[a, b]]) →
//   {ok: true, rows: [[code, …], …], wrapRows, wrapColumns}
//     wrapRows: right of the last code in a row comes the first one again
//     wrapColumns: below the last row comes the first one again
//   {ok: false, reason, codes?} — reason: 'empty' | 'isolated' | 'disconnected' | 'degree' | 'shape'
//
// How: for every shape that fits the number of devices and links, place devices cell by cell,
// each one linked exactly to the already placed neighbours of its cell. A full placement is a proof.
// Within each of these shapes any device with the right number of links can be the top left one,
// so a single start is enough, and wrong branches die within a row or two.
module.exports = {findGrid};

// A pathological graph must not hang the bot: give up after this many placement attempts
const stepLimit = 200000;

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

    const reachable = reach(codes[0], neighbours);
    if (reachable.size !== n) {
        return {ok: false, reason: 'disconnected', codes: codes.filter((code) => !reachable.has(code))};
    }

    const degrees = degreeKey(codes.map((code) => neighbours.get(code).size));
    for (const shape of shapes(n)) {
        if (degreeKey(shape.cells.map((cell) => cell.neighbours.length)) !== degrees) {
            continue;
        }

        const placed = place(shape, codes, neighbours);
        if (placed !== null) {
            return {ok: true, rows: canonical(shape, placed), wrapRows: shape.wrapRows, wrapColumns: shape.wrapColumns};
        }
    }

    return {ok: false, reason: 'shape'};
}

// Plain grids first (a 2×2 grid is also a ring of 4: call it a grid), then rings, then tori.
// A glued side needs at least 3 devices: with 2 the "glued" link is the one already there.
function shapes(n) {
    const result = [];
    const divisors = [];
    for (let rows = 1; rows <= n; rows++) {
        if (n % rows === 0) {
            divisors.push(rows);
        }
    }

    for (const rows of divisors) {
        if (rows <= n / rows) {
            result.push(makeShape(rows, n / rows, false, false));
        }
    }
    for (const rows of divisors) {
        if (n / rows >= 3) {
            result.push(makeShape(rows, n / rows, true, false));
        }
    }
    for (const rows of divisors) {
        if (rows >= 3 && n / rows >= rows) {
            result.push(makeShape(rows, n / rows, true, true));
        }
    }
    return result;
}

function makeShape(height, width, wrapRows, wrapColumns) {
    const cells = [];
    for (let i = 0; i < height; i++) {
        for (let j = 0; j < width; j++) {
            const around = [];
            const add = (y, x) => {
                if (wrapColumns) y = (y + height) % height;
                if (wrapRows) x = (x + width) % width;
                if (y >= 0 && y < height && x >= 0 && x < width && !(y === i && x === j)) {
                    const index = y * width + x;
                    if (!around.includes(index)) {
                        around.push(index);
                    }
                }
            };
            add(i - 1, j);
            add(i + 1, j);
            add(i, j - 1);
            add(i, j + 1);
            cells.push({neighbours: around});
        }
    }
    return {height, width, wrapRows, wrapColumns, cells};
}

// Codes by cell (row by row), or null. Cells are filled by anti-diagonals: (0,0), (0,1), (1,0), (0,2)…
// so that almost every cell has two placed neighbours already and a wrong turn dies at once.
// Filling row by row would let the first row wander into the second one unnoticed for a long time.
function place(shape, codes, neighbours) {
    const n = codes.length;
    const grid = new Array(n).fill(null);
    const position = new Map();
    let steps = 0;

    const order = shape.cells.map((cell, index) => index).sort((a, b) => {
        const [ai, aj] = [Math.floor(a / shape.width), a % shape.width];
        const [bi, bj] = [Math.floor(b / shape.width), b % shape.width];
        return (ai + aj) - (bi + bj) || ai - bi;
    });
    const rank = new Array(n);
    order.forEach((index, step) => {
        rank[index] = step;
    });
    const earlier = shape.cells.map((cell, index) => cell.neighbours.filter((other) => rank[other] < rank[index]));
    const degreeOf = (index) => shape.cells[index].neighbours.length;
    const fits = (code, index) => {
        if (neighbours.get(code).size !== degreeOf(index)) {
            return false;
        }
        let placedNeighbours = 0;
        for (const other of neighbours.get(code)) {
            if (position.has(other)) {
                if (!earlier[index].includes(position.get(other))) {
                    return false;
                }
                placedNeighbours++;
            }
        }
        return placedNeighbours === earlier[index].length;
    };

    const start = codes.find((code) => neighbours.get(code).size === degreeOf(0));
    const fill = (step) => {
        if (step === n) {
            return true;
        }
        if (++steps > stepLimit) {
            return false;
        }

        const index = order[step];
        const candidates = index === 0
            ? [start]
            : [...neighbours.get(grid[earlier[index][0]])].filter((code) => !position.has(code)).sort();
        for (const code of candidates) {
            if (code === undefined || !fits(code, index)) {
                continue;
            }
            grid[index] = code;
            position.set(code, index);
            if (fill(step + 1)) {
                return true;
            }
            grid[index] = null;
            position.delete(code);
        }
        return false;
    };

    return fill(0) ? grid : null;
}

// The same picture can be turned, mirrored and, along glued sides, shifted.
// Pick one predictably: the smallest codes first, reading row by row.
function canonical(shape, grid) {
    const {height, width, wrapRows, wrapColumns} = shape;
    let best = null;
    const transposes = height === width && wrapRows === wrapColumns ? [false, true] : [false];
    for (const transpose of transposes) {
        for (const flipRows of [false, true]) {
            for (const flipColumns of [false, true]) {
                for (let shiftRows = 0; shiftRows < (wrapColumns ? height : 1); shiftRows++) {
                    for (let shiftColumns = 0; shiftColumns < (wrapRows ? width : 1); shiftColumns++) {
                        const rows = [];
                        for (let i = 0; i < height; i++) {
                            const row = [];
                            for (let j = 0; j < width; j++) {
                                let y = (i + shiftRows) % height;
                                let x = (j + shiftColumns) % width;
                                if (flipRows) y = height - 1 - y;
                                if (flipColumns) x = width - 1 - x;
                                row.push(transpose ? grid[x * width + y] : grid[y * width + x]);
                            }
                            rows.push(row);
                        }
                        const flat = rows.flat().join(' ');
                        if (best === null || flat < best.flat) {
                            best = {flat, rows};
                        }
                    }
                }
            }
        }
    }
    return best.rows;
}

function degreeKey(degrees) {
    return degrees.slice().sort().join();
}

function reach(start, neighbours) {
    const seen = new Set([start]);
    const queue = [start];
    for (let head = 0; head < queue.length; head++) {
        for (const next of neighbours.get(queue[head])) {
            if (!seen.has(next)) {
                seen.add(next);
                queue.push(next);
            }
        }
    }
    return seen;
}
