"""Synthetic HCP behaviour generator (requirements §6 rule 4).

600 sample HCPs from 9 written personas plus per-HCP noise. Histories go through the real
eligibility filter, so no synthetic HCP ever engages with an item they could not be shown
(country separation holds in the peer signals by construction).

Output: data/artifacts/synthetic.json  (hcps, identities, events, impressions; times are
offsets in seconds before "now" so the history is always recent at load time).
"""
from __future__ import annotations

import hashlib
import json
from datetime import date

import numpy as np

from app.config import ARTIFACTS, catalogue_file, site_config
from app.rules import RuleContext, Viewer, filter_items

SEED = 20261118
DAYS = 90

# Each persona: who they are and how they behave. topic weights are relative.
PERSONAS = [
    dict(id="glaucoma_video", n=78, specialties={"ophthalmologist": 1.0},
         countries={"SA": 0.45, "AE": 0.3, "KW": 0.15, "QA": 0.1}, ar_share=0.45,
         topics={"glaucoma": 6, "dry_eye": 2, "amd": 1}, video=0.75, depth=0.75, sessions=(6, 14)),
    dict(id="retina_readers", n=72, specialties={"ophthalmologist": 1.0},
         countries={"SA": 0.35, "EG": 0.35, "KW": 0.15, "BH": 0.15}, ar_share=0.6,
         topics={"amd": 5, "diabetic_retinopathy": 5, "glaucoma": 1}, video=0.25, depth=0.8, sessions=(5, 12)),
    dict(id="hf_cardiologists", n=74, specialties={"cardiologist": 1.0},
         countries={"SA": 0.4, "AE": 0.25, "EG": 0.25, "QA": 0.1}, ar_share=0.4,
         topics={"heart_failure": 6, "lipids": 4, "hypertension": 2}, video=0.35, depth=0.7, sessions=(6, 13)),
    dict(id="diabetes_primary_care", n=80,
         specialties={"general_practitioner": 0.5, "endocrinologist": 0.3, "internist": 0.2},
         countries={"SA": 0.3, "EG": 0.3, "IQ": 0.2, "KW": 0.2}, ar_share=0.65,
         topics={"type2_diabetes": 6, "diabetic_retinopathy": 2, "hypertension": 2, "lipids": 1}, video=0.45,
         depth=0.6, sessions=(4, 11)),
    dict(id="airways_video", n=62, specialties={"pulmonologist": 0.8, "general_practitioner": 0.2},
         countries={"SA": 0.35, "AE": 0.35, "QA": 0.15, "OM": 0.15}, ar_share=0.35,
         topics={"asthma": 5, "copd": 5, "rsv_vaccination": 1}, video=0.7, depth=0.65, sessions=(5, 12)),
    dict(id="vaccine_minded_gps", n=58, specialties={"general_practitioner": 0.7, "internist": 0.3},
         countries={"AE": 0.3, "SA": 0.3, "OM": 0.2, "BH": 0.2}, ar_share=0.5,
         topics={"rsv_vaccination": 6, "hypertension": 2, "asthma": 1}, video=0.4, depth=0.55, sessions=(3, 9)),
    dict(id="migraine_neuro", n=60, specialties={"neurologist": 1.0},
         countries={"AE": 0.35, "SA": 0.35, "EG": 0.3}, ar_share=0.45,
         topics={"migraine": 6, "epilepsy": 2, "multiple_sclerosis": 1}, video=0.5, depth=0.7, sessions=(5, 12)),
    dict(id="menopause_bone", n=68, specialties={"obgyn": 0.85, "general_practitioner": 0.15},
         countries={"SA": 0.3, "AE": 0.3, "BH": 0.2, "OM": 0.2}, ar_share=0.55,
         topics={"menopause": 6, "osteoporosis": 4, "contraception": 1}, video=0.4, depth=0.7, sessions=(5, 12)),
    dict(id="light_browsers", n=45,
         specialties={"general_practitioner": 0.4, "pharmacist": 0.3, "internist": 0.3},
         countries={"SA": 0.2, "AE": 0.2, "EG": 0.2, "IQ": 0.2, "KW": 0.2}, ar_share=0.5,
         topics=None, video=0.5, depth=0.35, sessions=(1, 3)),
]

# Prepared personas for the live demo launcher (fixed IDs, generated like everyone else).
PREPARED = [
    dict(hcp_id="hcp_demo_cardio", persona="hf_cardiologists", specialty="cardiologist", country="SA",
         language="en", verified=True, tracking=True, crm=True, sessions=16,
         name="Dr. Khalid Al-Mansouri", label="Long history, cardiology"),
    dict(hcp_id="hcp_demo_unverified", persona="glaucoma_video", specialty="ophthalmologist", country="AE",
         language="en", verified=False, tracking=True, crm=True, sessions=2,
         name="Dr. Sara Haddad", label="Registered, not verified"),
    dict(hcp_id="hcp_demo_nocrm", persona="migraine_neuro", specialty="neurologist", country="KW",
         language="ar", verified=True, tracking=True, crm=False, sessions=8,
         name="Dr. Lina Nasser", label="No CRM consent"),
]

FIRST = ["Ahmed", "Mohammed", "Fatima", "Omar", "Mariam", "Khalid", "Noura", "Yousef", "Layla", "Hassan", "Aisha", "Abdullah", "Reem", "Tariq", "Huda", "Faisal", "Salma", "Karim", "Dana", "Hamad", "Rania", "Ziad", "Noor", "Sami", "Priya", "Arjun", "Sarah", "James", "Elena", "Rahul"]
LAST = ["Al-Mansouri", "Al-Harbi", "Al-Qahtani", "Al-Shamsi", "Al-Mutairi", "Al-Kuwari", "Al-Balushi", "Al-Saadi", "Haddad", "Nasser", "Khalil", "Farouk", "Hassan", "Ibrahim", "El-Sayed", "Mostafa", "Al-Jaber", "Al-Zahrani", "Al-Ansari", "Saleh", "Al-Hashimi", "Al-Obaidi", "Mahmoud", "Darwish", "Nair", "Menon", "Thomas", "Fernandes"]

# Level mix of items shown vs items clicked, per slot. Clicked items lean to personalised
# levels, so per-level CTR in analytics is consistent with the example A/B result.
SHOWN_LEVELS = {
    "home_recommended": {"L2": 0.35, "L1": 0.25, "L3": 0.1, "editor": 0.2, "exploration": 0.1},
    "ta_page": {"L2": 0.5, "L1": 0.2, "editor": 0.2, "exploration": 0.1},
    "peers": {"L3": 1.0},
    "start_here": {"editor": 0.7, "L1": 0.3},
    "next": {"L2": 1.0},
}
CLICKED_LEVELS = {
    "home_recommended": {"L2": 0.5, "L1": 0.17, "L3": 0.18, "editor": 0.1, "exploration": 0.05},
    "ta_page": {"L2": 0.66, "L1": 0.16, "editor": 0.12, "exploration": 0.06},
    "peers": {"L3": 1.0},
    "start_here": {"editor": 0.65, "L1": 0.35},
    "next": {"L2": 1.0},
}
ROWS_PER_SESSION = 3
SLOT_MIX = {"home_recommended": 0.42, "ta_page": 0.25, "peers": 0.14, "start_here": 0.07, "next": 0.12}

# Example A/B test (shown as one example results screen; see demo scope). Arm B is the
# personalised ranker, arm A editor-curated lists. Traffic is simulated: this is the share
# of engagements that start from a recommendation row in each arm.
AB_EXPERIMENT = "exp-home-ranker-01"
AB_ATTRIBUTION = {"A": 0.50, "B": 0.60}


def sticky_variant(hcp_id: str, experiment_id: str) -> str:
    """Sticky assignment: hash of HCP ID + experiment ID (requirements §8 A/B rule 2)."""
    h = int(hashlib.sha256(f"{hcp_id}:{experiment_id}".encode()).hexdigest(), 16)
    return "A" if h % 2 == 0 else "B"


def _choice(rng, d: dict):
    keys = list(d)
    p = np.array([d[k] for k in keys], dtype=float)
    return keys[rng.choice(len(keys), p=p / p.sum())]


def generate() -> dict:
    rng = np.random.default_rng(SEED)
    cfg = site_config()
    items = catalogue_file()["items"]
    by_id = {it["item_id"]: it for it in items}
    topics_all = list(cfg["topics"])
    ctx = RuleContext(country_rules=cfg["country_rules"], today=date.fromisoformat(catalogue_file()["anchor_date"]))

    hcps, identities, events, impressions = [], [], [], []
    ev_counter = 0
    imp_counter = 0

    persona_by_id = {p["id"]: p for p in PERSONAS}
    plan = []
    n = 0
    for p in PERSONAS:
        for _ in range(p["n"]):
            n += 1
            plan.append((f"hcp_s{n:04d}", p, None))
    for pp in PREPARED:
        plan.append((pp["hcp_id"], persona_by_id[pp["persona"]], pp))

    for hcp_id, p, prep in plan:
        if prep:
            spec, country, lang = prep["specialty"], prep["country"], prep["language"]
            verified, tracking, crm = prep["verified"], prep["tracking"], prep["crm"]
            name = prep["name"]
        else:
            spec = _choice(rng, p["specialties"])
            country = _choice(rng, p["countries"])
            lang = "ar" if rng.random() < p["ar_share"] else "en"
            verified = rng.random() < 0.92
            tracking = True  # synthetic histories exist only for consented HCPs (§6 rule 2)
            crm = rng.random() < 0.8
            name = f"Dr. {FIRST[rng.integers(len(FIRST))]} {LAST[rng.integers(len(LAST))]}"

        hcps.append(dict(hcp_id=hcp_id, specialty=spec, profession="pharmacist" if spec == "pharmacist" else "physician",
                         country=country, language=lang, verified=verified, tracking_consent=tracking,
                         crm_consent=crm, persona=p["id"] if not prep else f"prepared:{p['id']}"))
        lic = f"{country}-{rng.integers(100000, 999999)}"
        identities.append(dict(hcp_id=hcp_id, full_name=name, email=f"{hcp_id}@example.org", licence_no=lic,
                               oce_id=f"OCE-{country}-{rng.integers(1000000, 9999999)}"))

        viewer = Viewer("verified" if verified else "registered", country)
        eligible, _ = filter_items(items, viewer, ctx)
        if not eligible:
            continue

        # Per-HCP preferences = persona + noise (Dirichlet), so clusters are real but fuzzy.
        if p["topics"] and prep:  # prepared personas: a clean, coherent history for the stage
            base = np.array([p["topics"].get(t, 0.004) for t in topics_all], dtype=float)
            tw = rng.dirichlet(base / base.sum() * 400 + 0.001)
        elif p["topics"]:
            base = np.array([p["topics"].get(t, 0.05) for t in topics_all], dtype=float)
            tw = rng.dirichlet(base / base.sum() * 40 + 0.05)
        else:
            tw = rng.dirichlet(np.ones(len(topics_all)) * 0.8)
        topic_w = dict(zip(topics_all, tw))
        video_pref = float(np.clip(p["video"] + rng.normal(0, 0.1), 0.05, 0.95))
        depth = float(np.clip(p["depth"] + rng.normal(0, 0.12), 0.1, 1.0))
        n_sessions = prep["sessions"] if prep else int(rng.integers(p["sessions"][0], p["sessions"][1] + 1))
        variant = sticky_variant(hcp_id, AB_EXPERIMENT)

        # session start offsets (seconds before now), oldest first
        offs = np.sort(rng.uniform(3600 * 6, DAYS * 86400, size=n_sessions))[::-1]
        completed: set[str] = set()
        for s_idx, off in enumerate(offs):
            sid = f"s-{hcp_id}-{s_idx:03d}"
            device = "mobile" if rng.random() < 0.55 else "desktop"
            t = float(off)
            cand = [it for it in eligible if it["item_id"] not in completed]
            if not cand:
                break
            w = np.array([topic_w[it["topics"][0]] * (video_pref if it["type"] == "video" else 1 - video_pref)
                          * (1.25 if it.get("editor_pick") else 1.0) for it in cand], dtype=float)
            k = min(len(cand), int(rng.integers(1, 4)))
            picks = rng.choice(len(cand), size=k, replace=False, p=w / w.sum())

            # several recommendation rows per session → impressions; some engagements start from a row
            slots = list(rng.choice(list(SLOT_MIX), size=ROWS_PER_SESSION, replace=False,
                                    p=np.array(list(SLOT_MIX.values())) / sum(SLOT_MIX.values())))
            clicked = [cand[pi]["item_id"] for pi in picks if rng.random() < AB_ATTRIBUTION[variant]]
            fill_w = np.array([topic_w[it["topics"][0]] + 0.05 for it in eligible], dtype=float)
            shown: set[str] = set()
            for r_idx, slot in enumerate(slots):
                row = [c for j, c in enumerate(clicked) if j % ROWS_PER_SESSION == r_idx]
                for fi in rng.choice(len(eligible), size=min(len(eligible), 14), replace=False, p=fill_w / fill_w.sum()):
                    if len(row) >= 6:
                        break
                    iid = eligible[fi]["item_id"]
                    if iid not in row and iid not in shown and iid not in clicked:
                        row.append(iid)
                rng.shuffle(row)
                req = f"req-{hcp_id}-{s_idx:03d}-{r_idx}"
                for rank, iid in enumerate(row):
                    shown.add(iid)
                    imp_counter += 1
                    lv = CLICKED_LEVELS[slot] if iid in clicked else SHOWN_LEVELS[slot]
                    impressions.append(dict(n=imp_counter, request_id=req, hcp_id=hcp_id, session_id=sid, item_id=iid,
                                            slot=slot, rank=rank, level=_choice(rng, lv),
                                            t=t + 1, experiment_id=AB_EXPERIMENT, experiment_variant=variant))

            for pi in picks:
                it = cand[pi]
                iid = it["item_id"]
                t -= float(rng.uniform(20, 90))  # later in the session = smaller offset

                def emit(et, value=None):
                    nonlocal ev_counter
                    ev_counter += 1
                    events.append(dict(n=ev_counter, hcp_id=hcp_id, item_id=iid, event_type=et,
                                       value=None if value is None else str(value), session_id=sid, device=device,
                                       country=country, language=lang, t=t))

                emit("item_open")
                if rng.random() < 0.03:
                    emit("dismiss")
                    continue
                d = float(np.clip(depth + rng.normal(0, 0.2), 0.0, 1.0))
                if it["type"] == "article":
                    for m in (25, 50, 75, 100):
                        if d * 100 >= m:
                            t -= 15
                            emit("article_scroll", m)
                    secs = int(d * it["word_count"] / 230 * 60)
                    if d >= 0.6:
                        emit("article_read", secs)
                        completed.add(iid)
                    emit("time_spent", max(5, secs))
                else:
                    emit("video_start")
                    for m in (25, 50, 75, 100):
                        if d * 100 >= m - 2:
                            t -= it["duration_seconds"] * 0.25
                            emit("video_progress", m)
                    if d >= 0.98:
                        completed.add(iid)
                    emit("time_spent", int(d * it["duration_seconds"]))

    return dict(seed=SEED, ab_experiment=AB_EXPERIMENT, ab_attribution=AB_ATTRIBUTION, prepared=PREPARED,
                hcps=hcps, identities=identities, events=events, impressions=impressions)


def main() -> None:
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    out = generate()
    (ARTIFACTS / "synthetic.json").write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
    print(f"synthetic: {len(out['hcps'])} HCPs, {len(out['events'])} events, {len(out['impressions'])} impressions")


if __name__ == "__main__":
    main()
