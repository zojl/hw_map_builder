// Stress majorization layout (as in graphviz neato): places devices so that on-screen distances
// match graph distances in hops. Grids unfold into grids instead of folding like force layouts do.
// Deterministic: classical MDS gives the start, SMACOF refines it. Fine for a subnet (≤ 256 devices).
// stressLayout(ids, edges: [[sourceId, targetId]], edgeLength) → {id: {x, y}}
(function(root) {
    function stressLayout(ids, edges, edgeLength) {
        const n = ids.length;
        const positions = {};
        if (n === 0) {
            return positions;
        }
        if (n === 1) {
            positions[ids[0]] = {x: 0, y: 0};
            return positions;
        }

        const index = new Map(ids.map((id, i) => [id, i]));
        const adjacency = ids.map(() => []);
        for (const [source, target] of edges) {
            const a = index.get(source);
            const b = index.get(target);
            if (a !== undefined && b !== undefined && a !== b) {
                adjacency[a].push(b);
                adjacency[b].push(a);
            }
        }

        // Hops between all pairs (BFS from each device). Separate components are kept a bit
        // further apart than the longest path, so they sit next to each other, not on top.
        const hops = new Float64Array(n * n).fill(-1);
        let longest = 1;
        for (let s = 0; s < n; s++) {
            const queue = [s];
            hops[s * n + s] = 0;
            for (let head = 0; head < queue.length; head++) {
                const v = queue[head];
                const next = hops[s * n + v] + 1;
                for (const w of adjacency[v]) {
                    if (hops[s * n + w] < 0) {
                        hops[s * n + w] = next;
                        longest = Math.max(longest, next);
                        queue.push(w);
                    }
                }
            }
        }
        const apart = Math.max(2, Math.ceil(Math.sqrt(n) / 2), Math.ceil(longest / 2));
        const distance = new Float64Array(n * n);
        for (let i = 0; i < n * n; i++) {
            distance[i] = (hops[i] < 0 ? apart : hops[i]) * edgeLength;
        }

        const xs = new Float64Array(n);
        const ys = new Float64Array(n);
        classicalMds(distance, n, xs, ys);
        smacof(distance, n, xs, ys);

        ids.forEach((id, i) => {
            positions[id] = {x: xs[i], y: ys[i]};
        });
        return positions;
    }

    // Start positions: top two eigenvectors of the double-centered squared distances (power iteration)
    function classicalMds(distance, n, xs, ys) {
        const b = new Float64Array(n * n);
        const rowMean = new Float64Array(n);
        let totalMean = 0;
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                const sq = distance[i * n + j] * distance[i * n + j];
                b[i * n + j] = sq;
                rowMean[i] += sq / n;
            }
            totalMean += rowMean[i] / n;
        }
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                b[i * n + j] = -0.5 * (b[i * n + j] - rowMean[i] - rowMean[j] + totalMean);
            }
        }

        const first = powerIteration(b, n, null);
        const second = powerIteration(b, n, first.vector);
        const scaleX = Math.sqrt(Math.max(first.value, 1e-9));
        const scaleY = Math.sqrt(Math.max(second.value, 1e-9));
        for (let i = 0; i < n; i++) {
            // A tiny deterministic jitter, so devices with identical distances don't start in one point
            xs[i] = first.vector[i] * scaleX + Math.sin(i * 12.9898) * 1e-3;
            ys[i] = second.vector[i] * scaleY + Math.cos(i * 78.233) * 1e-3;
        }
    }

    function powerIteration(matrix, n, orthogonalTo) {
        let vector = new Float64Array(n);
        for (let i = 0; i < n; i++) {
            vector[i] = 1 + ((i * 7919) % 13) / 13;
        }
        let value = 0;
        for (let iteration = 0; iteration < 300; iteration++) {
            if (orthogonalTo !== null) {
                let dot = 0;
                for (let i = 0; i < n; i++) dot += vector[i] * orthogonalTo[i];
                for (let i = 0; i < n; i++) vector[i] -= dot * orthogonalTo[i];
            }
            const next = new Float64Array(n);
            for (let i = 0; i < n; i++) {
                let sum = 0;
                for (let j = 0; j < n; j++) sum += matrix[i * n + j] * vector[j];
                next[i] = sum;
            }
            let norm = 0;
            for (let i = 0; i < n; i++) norm += next[i] * next[i];
            norm = Math.sqrt(norm);
            if (norm < 1e-12) {
                break;
            }
            let change = 0;
            for (let i = 0; i < n; i++) {
                next[i] /= norm;
                change += Math.abs(next[i] - vector[i]);
            }
            vector = next;
            value = norm;
            if (change < 1e-7) {
                break;
            }
        }
        return {vector, value};
    }

    // Weighted stress, w = d^-2: near devices matter most. Localized SMACOF updates.
    function smacof(distance, n, xs, ys) {
        const weight = new Float64Array(n * n);
        const weightSum = new Float64Array(n);
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                if (i !== j) {
                    weight[i * n + j] = 1 / (distance[i * n + j] * distance[i * n + j]);
                    weightSum[i] += weight[i * n + j];
                }
            }
        }

        let previous = Infinity;
        for (let iteration = 0; iteration < 500; iteration++) {
            for (let i = 0; i < n; i++) {
                let sumX = 0;
                let sumY = 0;
                const x = xs[i];
                const y = ys[i];
                for (let j = 0; j < n; j++) {
                    if (i === j) continue;
                    const w = weight[i * n + j];
                    const dx = x - xs[j];
                    const dy = y - ys[j];
                    const scale = distance[i * n + j] / (Math.sqrt(dx * dx + dy * dy) || 1e-9);
                    sumX += w * (xs[j] + dx * scale);
                    sumY += w * (ys[j] + dy * scale);
                }
                xs[i] = sumX / weightSum[i];
                ys[i] = sumY / weightSum[i];
            }

            if (iteration % 10 !== 9) {
                continue;
            }

            let stress = 0;
            for (let i = 0; i < n; i++) {
                for (let j = i + 1; j < n; j++) {
                    const d = distance[i * n + j];
                    const dx = xs[i] - xs[j];
                    const dy = ys[i] - ys[j];
                    const diff = Math.sqrt(dx * dx + dy * dy) - d;
                    stress += diff * diff / (d * d);
                }
            }
            // Checked every 10 iterations: stop once they improve it by less than 0.01%
            if (previous - stress < 1e-4 * previous) {
                break;
            }
            previous = stress;
        }
    }

    root.stressLayout = stressLayout;
})(typeof window !== 'undefined' ? window : globalThis);
