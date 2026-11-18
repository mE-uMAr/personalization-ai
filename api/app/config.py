"""Engine settings. Every tunable number in the demo lives here, in one place."""
from __future__ import annotations

import json
import os
from functools import lru_cache
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
ARTIFACTS = DATA / "artifacts"

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://demo@127.0.0.1:5433/hcp")
DB_POOL_SIZE = int(os.environ.get("DB_POOL_SIZE", "8"))

MODEL_VERSION = "formula-1.0.0"  # bump whenever a weight below changes

# ── Level 1: therapy-area affinity ─────────────────────────────────────────────
SPECIALTY_BONUS = 5.0           # starting points for the TA mapped from declared specialty
TA_SWITCH_MARGIN = 0.15         # a new TA must beat the current landing TA by 15%
HALF_LIFE_DAYS = 30.0           # time decay for affinity and item weights

# Points per event (requirements §2 L1/L2; §6 rule 1 for positive labels)
POINTS = {
    "item_open": 1.0,
    "article_read": 3.0,        # >=60% scroll with minimum dwell, or minimum read time
    "video_progress": {25: 1.0, 50: 2.0, 75: 0.0, 100: 3.0},  # milestones 1/2/3; 75% logged only
    "save": 2.0,
    "dismiss": -3.0,            # negative signal
}
# What counts as an "action" for cold start: opening, finishing an article, watching half a video,
# saving, dismissing, searching.
ACTION_EVENTS = {"item_open", "article_read", "save", "dismiss", "search"}
ACTION_VIDEO_MILESTONE = 50
COLD_START_ACTIONS = 5          # α = min(actions / 5, 1)  (requirements §5: "fewer than 5 actions")
CLUSTER_ASSIGN_ACTIONS = 5      # live HCP moves from provisional to nearest real cluster

# ── Scoring weights ─────────────────────────────────────────────────────────────
COLD_WEIGHTS = {"editor": 0.55, "specialty_pop": 0.45}
PERSONAL_WEIGHTS = {"content": 0.35, "ta_affinity": 0.30, "peer_pop": 0.20, "freshness": 0.15}
TA_RANK_WEIGHT = [1.0, 0.32, 0.24, 0.18, 0.14]  # how much each TA position counts on the home page
FRESHNESS_HALF_LIFE_DAYS = 45.0

# ── List shaping ────────────────────────────────────────────────────────────────
ROW_SIZE = 6
DIVERSITY_MAX_PER_TOPIC = 3      # per slot of 6 (requirements §7 rule 5)
EXPLORATION_SHARE = 0.10
EXPLORATION_POSITION = 4         # 0-based slot where the exploration item lands
MIN_CLUSTER_SIZE = 20            # requirements §7 rule 8
PEER_MIN_LIFT = 1.2
BECAUSE_MIN_COSINE = 0.68         # "Because you read X" only when X is genuinely similar
RELATED_MIN_COSINE = 0.66         # "Related to X" on end-of-item rows
EXPLORATION_PROBABILITY = 0.6     # a row of 6 gets an exploration slot 60% of the time ≈ 10% of items
MAX_PER_TA_IN_ROW = 4             # home rows keep some breadth across therapy areas              # peers row: items the cluster engages with more than everyone else
LATENCY_BUDGET_MS = 150          # over budget → serve editor-curated lists

CRM_SYNC_SECONDS = float(os.environ.get("CRM_SYNC_SECONDS", "5"))  # production: 15-minute batches

LEVELS = ("L1", "L2", "L3", "editor", "exploration")


@lru_cache
def site_config() -> dict:
    return json.loads((DATA / "config.json").read_text(encoding="utf-8"))


@lru_cache
def catalogue_file() -> dict:
    return json.loads((DATA / "catalogue.json").read_text(encoding="utf-8"))
