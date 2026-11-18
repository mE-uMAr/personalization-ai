"""In-memory runtime state: catalogue, item embeddings, popularity tables, clusters.

~80 items × 1024-dim vectors — scoring everything with numpy on every request takes
microseconds, so there is no candidate-retrieval stage (pgvector matters only at the
500+ items of production).
"""
from __future__ import annotations

import json
import threading
from collections import Counter, defaultdict
from datetime import date

import numpy as np

from app.config import ARTIFACTS, site_config
from app.db import db
from app.rules import RuleContext


class Store:
    def __init__(self) -> None:
        self.lock = threading.RLock()
        self.cfg = site_config()
        self.ta_ids = [t["id"] for t in self.cfg["therapy_areas"]]
        self.items: dict[str, dict] = {}
        self.order: list[str] = []
        self.emb: np.ndarray | None = None
        self.emb_index: dict[str, int] = {}
        self.sim: np.ndarray | None = None
        self.pop_cluster: dict[int, dict[str, float]] = {}
        self.pop_global: dict[str, float] = {}
        self.pop_spec: dict[tuple[str, str], dict[str, float]] = {}
        self.clusters: dict[int, dict] = {}
        self.blocks: set[tuple[str, str]] = set()
        self.pins: list[dict] = []
        self.imp_count: Counter = Counter()
        self.behaviour_X: np.ndarray | None = None
        self.behaviour_xy: np.ndarray | None = None
        self.behaviour_ids: list[str] = []
        self.embed_meta: dict = {}

    # ── loading ────────────────────────────────────────────────────────────────
    def load(self) -> None:
        with self.lock:
            self._load_embeddings()
            self.reload_items()
            self.reload_overrides()
            with db() as c:
                rows = c.all("SELECT cluster_id, item_id, score FROM pop_cluster")
                pc: dict[int, dict[str, float]] = defaultdict(dict)
                for r in rows:
                    pc[r["cluster_id"]][r["item_id"]] = r["score"]
                self.pop_cluster = dict(pc)
                glob: dict[str, float] = defaultdict(float)
                for d in pc.values():
                    for k, v in d.items():
                        glob[k] += v
                self.pop_global = dict(glob)
                ps: dict[tuple, dict[str, float]] = defaultdict(dict)
                for r in c.all("SELECT specialty, country, item_id, score FROM pop_specialty"):
                    ps[(r["specialty"], r["country"])][r["item_id"]] = r["score"]
                self.pop_spec = dict(ps)
                self.clusters = {r["cluster_id"]: r for r in c.all("SELECT * FROM clusters ORDER BY cluster_id")}
                self.imp_count = Counter({r[0]: r[1] for r in c.run("SELECT item_id, count(*) FROM impressions GROUP BY 1")})
            bx = ARTIFACTS / "behaviour_X.npy"
            if bx.exists():
                self.behaviour_X = np.load(bx)
                meta = json.loads((ARTIFACTS / "clusters.json").read_text(encoding="utf-8"))
                self.behaviour_ids = [a["hcp_id"] for a in meta["assignments"]]
                self.behaviour_xy = np.array([[a["x"], a["y"]] for a in meta["assignments"]])
                self.behaviour_labels = np.array([a["cluster_id"] for a in meta["assignments"]])

    def _load_embeddings(self) -> None:
        meta = json.loads((ARTIFACTS / "item_embeddings.json").read_text(encoding="utf-8"))
        v = np.load(ARTIFACTS / "item_embeddings.npy").astype(np.float32)
        self.embed_meta = meta
        self.emb = v
        self.emb_index = {iid: i for i, iid in enumerate(meta["items"])}
        self.sim = v @ v.T

    def reload_items(self) -> None:
        with db() as c:
            rows = c.all("SELECT item_id, data, status, expiry_date FROM items ORDER BY item_id")
        items = {}
        for r in rows:
            d = r["data"] if isinstance(r["data"], dict) else json.loads(r["data"])
            d["status"] = r["status"]
            d["expiry_date"] = r["expiry_date"].isoformat() if isinstance(r["expiry_date"], date) else r["expiry_date"]
            items[r["item_id"]] = d
        with self.lock:
            self.items = items
            self.order = list(items)

    def reload_overrides(self) -> None:
        with db() as c:
            rows = c.all("SELECT action, country, ta, item_id FROM overrides ORDER BY id")
        with self.lock:
            self.blocks = {(r["country"], r["item_id"]) for r in rows if r["action"] == "block"}
            self.pins = [r for r in rows if r["action"] == "pin"]

    # ── helpers ────────────────────────────────────────────────────────────────
    def rule_ctx(self) -> RuleContext:
        return RuleContext(country_rules=self.cfg["country_rules"], blocks=self.blocks)

    def ta(self, ta_id: str) -> dict:
        return next(t for t in self.cfg["therapy_areas"] if t["id"] == ta_id)

    def specialty_ta(self, specialty: str) -> str:
        return self.cfg["specialties"][specialty]["ta"]

    def vec(self, item_id: str) -> np.ndarray:
        return self.emb[self.emb_index[item_id]]

    def similarity(self, a: str, b: str) -> float:
        return float(self.sim[self.emb_index[a], self.emb_index[b]])

    def overall_pop(self, country: str) -> dict[str, float]:
        """All specialties in one market (anonymous visitors have no declared specialty)."""
        out: dict[str, float] = defaultdict(float)
        for (spec, c), d in self.pop_spec.items():
            if c == country:
                for k, v in d.items():
                    out[k] += v
        return dict(out)

    def reload_impression_counts(self) -> None:
        with db() as c:
            self.imp_count = Counter({r[0]: r[1] for r in c.run("SELECT item_id, count(*) FROM impressions GROUP BY 1")})

    def specialty_pop(self, specialty: str, country: str) -> dict[str, float]:
        """Same specialty in the same country; blended with specialty-wide when the cohort is thin."""
        local = self.pop_spec.get((specialty, country), {})
        wide = self.pop_spec.get((specialty, "*"), {})
        if sum(local.values()) >= 40:
            return local
        out = defaultdict(float)
        for k, v in wide.items():
            out[k] += 0.4 * v
        for k, v in local.items():
            out[k] += v
        return dict(out)


store = Store()
