"""Level 3: behaviour vectors → HDBSCAN clusters → plain-language labels (requirements §2 L3).

Behaviour vector per HCP: TA mix, topic mix, format preference, engagement depth, recency
and visit cadence. Clusters are found by the engine (HDBSCAN picks the number itself);
groups under MIN_CLUSTER_SIZE are never formed (min_cluster_size=20 by construction).

Output: data/artifacts/clusters.json
"""
from __future__ import annotations

import json
from collections import defaultdict

import numpy as np

from app.config import ARTIFACTS, MIN_CLUSTER_SIZE, catalogue_file, site_config
from app.behaviour import FEATURE_WEIGHTS, behaviour_matrix
from app.profile import event_points
from seed.hdbscan_np import tsne

MIN_SAMPLES = 5


def _lc(s: str) -> str:
    """Lower-case a topic name for mid-sentence use, keeping acronyms (COPD, RSV)."""
    return " ".join(w if w.isupper() and len(w) > 1 else w.lower() for w in s.split())


def run_hdbscan(X: np.ndarray) -> tuple[np.ndarray, str]:
    try:
        from sklearn.cluster import HDBSCAN  # type: ignore
        labels = HDBSCAN(min_cluster_size=MIN_CLUSTER_SIZE, min_samples=MIN_SAMPLES, copy=True).fit_predict(X)
        return labels, "sklearn.cluster.HDBSCAN"
    except Exception:  # noqa: BLE001 — blocked native extension or not installed
        from seed.hdbscan_np import hdbscan
        labels, _ = hdbscan(X, min_cluster_size=MIN_CLUSTER_SIZE, min_samples=MIN_SAMPLES)
        return labels, "seed.hdbscan_np (numpy/scipy HDBSCAN)"


FORMAT_LABEL = {
    "video": ("video watchers", "مشاهدو الفيديو"),
    "article": ("readers", "القرّاء"),
    "mixed": ("readers and viewers", "القرّاء والمشاهدون"),
}


def label_for(tp_mean: np.ndarray, fmt_mean: float, topics: list[str], cfg: dict) -> tuple[str, str, str]:
    order = np.argsort(-tp_mean)
    t1, t2 = topics[order[0]], topics[order[1]]
    fk = "video" if fmt_mean >= 0.55 else "article" if fmt_mean <= 0.38 else "mixed"
    en_t, ar_t = cfg["topics"][t1]["en"], cfg["topics"][t1]["ar"]
    if tp_mean[order[1]] > 0.6 * tp_mean[order[0]]:  # two strong topics → name both
        en_t = f"{en_t} & {_lc(cfg['topics'][t2]['en'])}"
        ar_t = f"{ar_t} و{cfg['topics'][t2]['ar']}"
    en = f"{en_t}-focused {FORMAT_LABEL[fk][0]}"
    ar = f"{FORMAT_LABEL[fk][1]} المهتمون ب{ar_t}"
    return en, ar, fk


def main() -> None:
    cfg = site_config()
    syn = json.loads((ARTIFACTS / "synthetic.json").read_text(encoding="utf-8"))
    items = {it["item_id"]: it for it in catalogue_file()["items"]}
    hcps = syn["hcps"]
    hcp_ids = [h["hcp_id"] for h in hcps]
    X, raw = behaviour_matrix(hcp_ids, syn["events"], items, cfg)
    labels, impl = run_hdbscan(X)
    np.save(ARTIFACTS / "behaviour_X.npy", X.astype(np.float32))  # for live HCP → nearest cluster
    topics = list(cfg["topics"])
    tas = [t["id"] for t in cfg["therapy_areas"]]

    Y = tsne(X, perplexity=35, iters=800, seed=7)
    Y = (Y - Y.mean(0)) / (np.abs(Y).max() or 1.0)

    # per-cluster item popularity (peer signal) and defining behaviours
    hcp_index = {h: i for i, h in enumerate(hcp_ids)}
    pop: dict[int, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    for e in syn["events"]:
        lab = labels[hcp_index[e["hcp_id"]]]
        if lab >= 0 and e.get("item_id"):
            pop[int(lab)][e["item_id"]] += max(0.0, event_points(e["event_type"], e.get("value")))

    overall_fmt = float(raw["fmt"].mean())
    overall_depth = float(raw["depth"].mean())
    clusters = []
    for c in sorted(set(int(x) for x in labels if x >= 0)):
        m = labels == c
        size = int(m.sum())
        assert size >= MIN_CLUSTER_SIZE
        tp_mean = raw["tp_mix"][m].mean(0)
        ta_mean = raw["ta_mix"][m].mean(0)
        fmt_mean = float(raw["fmt"][m].mean())
        depth_mean = float(raw["depth"][m].mean())
        en, ar, fk = label_for(tp_mean, fmt_mean, topics, cfg)
        top_ta = [{"ta": tas[i], "share": round(float(ta_mean[i]), 3)} for i in np.argsort(-ta_mean)[:3]]
        top_items = sorted(pop[c].items(), key=lambda kv: -kv[1])[:8]
        spec_counts: dict[str, int] = defaultdict(int)
        country_counts: dict[str, int] = defaultdict(int)
        for h, inc in zip(hcps, m):
            if inc:
                spec_counts[h["specialty"]] += 1
                country_counts[h["country"]] += 1
        ta0 = cfg["therapy_areas"][tas.index(top_ta[0]["ta"])]
        defining = [
            {"en": f"{round(top_ta[0]['share'] * 100)}% of engagement is in {ta0['en']}",
             "ar": f"{round(top_ta[0]['share'] * 100)}% من التفاعل في {ta0['ar']}"},
            {"en": f"Video makes up {round(fmt_mean * 100)}% of what they open (average {round(overall_fmt * 100)}%)",
             "ar": f"يشكل الفيديو {round(fmt_mean * 100)}% مما يفتحونه (المتوسط {round(overall_fmt * 100)}%)"},
            {"en": f"Finish {round(depth_mean * 100)}% of items they open (average {round(overall_depth * 100)}%)",
             "ar": f"يُكملون {round(depth_mean * 100)}% مما يفتحونه (المتوسط {round(overall_depth * 100)}%)"},
            {"en": f"Average {raw['cadence'][m].mean():.1f} visits in the last 90 days",
             "ar": f"بمعدل {raw['cadence'][m].mean():.1f} زيارة خلال آخر 90 يوماً"},
        ]
        clusters.append(dict(
            cluster_id=c, label_en=en, label_ar=ar, size=size, format=fk,
            defining=defining, top_tas=top_ta,
            top_items=[{"item_id": k, "score": round(v, 2)} for k, v in top_items],
            specialties=dict(sorted(spec_counts.items(), key=lambda kv: (-kv[1], kv[0]))),
            countries=dict(sorted(country_counts.items(), key=lambda kv: -kv[1])),
            centroid=X[m].mean(0).round(5).tolist(),
            x=float(Y[m, 0].mean()), y=float(Y[m, 1].mean()),
        ))

    # specialty×country popularity (cold start) and specialty-wide fallback ("*")
    spec_pop: dict[tuple, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    hmap = {h["hcp_id"]: h for h in hcps}
    for e in syn["events"]:
        if not e.get("item_id"):
            continue
        h = hmap[e["hcp_id"]]
        pts = max(0.0, event_points(e["event_type"], e.get("value")))
        spec_pop[(h["specialty"], h["country"])][e["item_id"]] += pts
        spec_pop[(h["specialty"], "*")][e["item_id"]] += pts

    noise = int((labels < 0).sum())
    out = dict(
        implementation=impl, min_cluster_size=MIN_CLUSTER_SIZE, min_samples=MIN_SAMPLES, feature_weights=FEATURE_WEIGHTS,
        n_hcps=len(hcps), n_clusters=len(clusters), noise=noise,
        clusters=clusters,
        assignments=[{"hcp_id": h, "cluster_id": int(l), "x": float(Y[i, 0]), "y": float(Y[i, 1])}
                     for i, (h, l) in enumerate(zip(hcp_ids, labels))],
        pop_cluster={str(c): {k: round(v, 3) for k, v in d.items()} for c, d in pop.items()},
        pop_specialty=[{"specialty": s, "country": co, "item_id": k, "score": round(v, 3)}
                       for (s, co), d in spec_pop.items() for k, v in d.items()],
    )
    (ARTIFACTS / "clusters.json").write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
    print(f"clusters ({impl}): {len(clusters)} clusters, noise={noise}/{len(hcps)}")
    for c in clusters:
        print(f"  #{c['cluster_id']:>2} n={c['size']:>3}  {c['label_en']}  | {list(c['specialties'])[:2]}")


if __name__ == "__main__":
    main()
