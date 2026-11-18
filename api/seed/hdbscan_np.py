"""HDBSCAN (Campello, Moulavi & Sander 2013) in numpy + scipy.

Used only when scikit-learn's `sklearn.cluster.HDBSCAN` cannot be imported (for example on
machines whose application-control policy blocks unsigned native extensions). Same
algorithm, same parameters: core distances → mutual-reachability graph → minimum spanning
tree → single-linkage hierarchy → condensed tree → excess-of-mass cluster selection.
Noise points get label -1. Exact O(n²) — fine for the demo's 600 HCPs.
"""
from __future__ import annotations

import numpy as np
from scipy.sparse.csgraph import minimum_spanning_tree
from scipy.spatial.distance import cdist


def hdbscan(X: np.ndarray, min_cluster_size: int = 20, min_samples: int | None = None) -> tuple[np.ndarray, np.ndarray]:
    """Return (labels, probabilities)."""
    n = len(X)
    k = min_samples or min_cluster_size
    D = cdist(X, X)
    core = np.sort(D, axis=1)[:, min(k - 1, n - 1)]  # k-th neighbour counting the point itself (as sklearn)
    mr = np.maximum(D, np.maximum(core[:, None], core[None, :]))
    np.fill_diagonal(mr, 0)
    mst = minimum_spanning_tree(mr + 1e-12 * (mr == 0)).tocoo()  # scipy ignores zero edges
    edges = sorted(zip(mst.data, mst.row, mst.col))

    # single linkage via union-find → scipy-style linkage rows [a, b, dist, size]
    parent = np.arange(2 * n - 1)
    size = np.ones(2 * n - 1, dtype=int)
    link = []

    def find(x):
        root = x
        while parent[root] != root:
            root = parent[root]
        while parent[x] != root:
            parent[x], x = root, parent[x]
        return root

    nxt = n
    for d, a, b in edges:
        ra, rb = find(a), find(b)
        link.append((ra, rb, d, size[ra] + size[rb]))
        parent[ra] = parent[rb] = nxt
        size[nxt] = size[ra] + size[rb]
        nxt += 1

    # condensed tree: (parent_cluster, child (point or cluster), lambda, child_size)
    root = 2 * n - 2
    children = {n + i: (int(r[0]), int(r[1]), float(r[2])) for i, r in enumerate(link)}

    def leaves(node):
        out, stack = [], [node]
        while stack:
            x = stack.pop()
            if x < n:
                out.append(x)
            else:
                a, b, _ = children[x]
                stack += [a, b]
        return out

    condensed = []
    label_of = {root: n}  # condensed cluster ids start at n
    next_label = n + 1
    stack = [root]
    while stack:
        node = stack.pop()
        cl = label_of[node]
        a, b, d = children[node]
        lam = 1.0 / d if d > 0 else np.inf
        sa, sb = (size[a] if a >= n else 1), (size[b] if b >= n else 1)
        if sa >= min_cluster_size and sb >= min_cluster_size:
            for c, s in ((a, sa), (b, sb)):
                label_of[c] = next_label
                condensed.append((cl, next_label, lam, s))
                next_label += 1
                stack.append(c)
        else:
            for c, s in ((a, sa), (b, sb)):
                if s >= min_cluster_size:
                    label_of[c] = cl
                    stack.append(c)
                else:
                    for p in leaves(c):
                        condensed.append((cl, p, lam, 1))
    ct = np.array(condensed, dtype=[("parent", int), ("child", int), ("lam", float), ("size", int)])

    # stability per cluster
    clusters = sorted(set(ct["parent"]))
    birth = {n: 0.0}
    for r in ct[ct["child"] >= n]:
        birth[r["child"]] = r["lam"]
    stability = {c: 0.0 for c in clusters}
    for r in ct:
        lam = min(r["lam"], 1e12)
        stability[r["parent"]] += (lam - birth[r["parent"]]) * r["size"]

    # excess of mass selection (bottom-up); root is never selected unless it's the only option
    child_clusters = {c: [int(r["child"]) for r in ct[(ct["parent"] == c) & (ct["child"] >= n)]] for c in clusters}
    selected = {c: True for c in clusters}
    for c in sorted(clusters, reverse=True):
        kids = child_clusters[c]
        if not kids:
            continue
        s_kids = sum(stability[k] for k in kids)
        if s_kids > stability[c] or c == n:
            stability[c] = s_kids
            selected[c] = False
        else:
            for d in _desc(c, child_clusters):
                selected[d] = False
    if len(clusters) > 1:
        selected[n] = False
    chosen = [c for c in clusters if selected[c]]

    labels = -np.ones(n, dtype=int)
    probs = np.zeros(n)
    point_lam = {int(r["child"]): (int(r["parent"]), r["lam"]) for r in ct if r["child"] < n}
    for li, c in enumerate(chosen):
        members = _desc(c, child_clusters) | {c}
        lam_max = max((min(r["lam"], 1e12) for r in ct if r["parent"] in members and r["child"] < n), default=1.0)
        for p, (par, lam) in point_lam.items():
            if par in members:
                labels[p] = li
                probs[p] = min(lam, 1e12) / lam_max if lam_max > 0 else 1.0
    return labels, probs


def _desc(c, child_clusters) -> set:
    out, stack = set(), list(child_clusters.get(c, []))
    while stack:
        x = stack.pop()
        out.add(x)
        stack += child_clusters.get(x, [])
    return out


def tsne(X: np.ndarray, perplexity: float = 30.0, iters: int = 750, seed: int = 0) -> np.ndarray:
    """Exact t-SNE (van der Maaten & Hinton 2008) for the 2D cluster map. Deterministic."""
    rng = np.random.default_rng(seed)
    n = len(X)
    D = cdist(X, X, "sqeuclidean")
    P = np.zeros((n, n))
    target = np.log(perplexity)
    for i in range(n):
        lo, hi, beta = 1e-20, 1e20, 1.0
        di = np.delete(D[i], i)
        for _ in range(64):
            p = np.exp(-di * beta)
            sp = p.sum() or 1e-12
            H = np.log(sp) + beta * (di * p).sum() / sp
            if abs(H - target) < 1e-5:
                break
            if H > target:
                lo = beta
                beta = beta * 2 if hi == 1e20 else (beta + hi) / 2
            else:
                hi = beta
                beta = (beta + lo) / 2
        P[i, np.arange(n) != i] = p / sp
    P = (P + P.T) / (2 * n)
    P = np.maximum(P, 1e-12)
    Y = rng.normal(0, 1e-4, (n, 2))
    vel = np.zeros_like(Y)
    gains = np.ones_like(Y)
    for it in range(iters):
        exag = 12.0 if it < 250 else 1.0
        sq = (Y ** 2).sum(1)
        num = 1.0 / (1.0 + sq[:, None] + sq[None, :] - 2 * Y @ Y.T)
        np.fill_diagonal(num, 0)
        Q = np.maximum(num / num.sum(), 1e-12)
        PQ = (exag * P - Q) * num
        grad = 4 * ((np.diag(PQ.sum(1)) - PQ) @ Y)
        mom = 0.5 if it < 250 else 0.8
        gains = np.where(np.sign(grad) != np.sign(vel), gains + 0.2, gains * 0.8).clip(0.01)
        vel = mom * vel - 200.0 * gains * grad
        Y = Y + vel
        Y -= Y.mean(0)
    return Y
