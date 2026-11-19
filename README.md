# AI Personalization Engine — working demo

A small application built like the production system. The HCP site, the engine, the console and a mock CRM run on
the production contracts from the requirements document (event schema, impression log, recommendation
request/response, item metadata), so the demo is the skeleton of the full build, not throwaway code.

```
web/      React + Vite SPA (HCP site, engine console, mock OCE, demo launcher)
api/      FastAPI modular monolith (rules, engine, events, CRM adapter, analytics) → one process, uv
api/seed/ offline pipeline: video ingestion, bge-m3 embeddings, synthetic HCPs, HDBSCAN  → run once
run.cmd   one command: Postgres → seed → API → web
```

## What runs for real, what is simulated

| Real | Simulated for the demo |
|---|---|
| Eligibility filter: status, expiry, market, promotional, gated, admin blocks (100% tests, 100% coverage) | 600 sample HCPs generated from 9 behaviour personas |
| Level 1 therapy-area order with time decay and a 15% switch margin | 80 sample items in five therapy areas, Arabic + English |
| Level 2 scoring recalculated on every request, with reasons from fixed templates | Generic markets A–H with a placeholder rule sheet |
| Level 3 clusters by HDBSCAN on behaviour vectors (min size 20), live HCP joins after 5 actions | Mock OCE rep view in place of the live connection |
| Item embeddings with **BAAI/bge-m3** (both languages averaged per item) | A/B testing shown as one example results screen |
| Video player counting seconds actually played; 25/50/75/100% milestones | Video narration from editorial copy (production: the client's own videos + ASR) |
| Impression log for every item shown; analytics built from events and impressions | |
| CRM adapter with outbox, batching, retry, consent gate | |

Ranking uses one transparent formula (the demo scope excludes trained ranking models):

```
cold     = 0.55·editor pick + 0.45·specialty popularity (same specialty, same market)
personal = 0.35·content match (L2) + 0.30·TA affinity (L1) + 0.20·peer popularity (L3) + 0.15·freshness
score    = (1 − α)·cold + α·personal,   α = min(actions / 5, 1)
```

The largest weighted part picks the reason template, so every "Why this?" is the honest top signal.
Every request: **filter → score → drop completed/dismissed → admin pins → diversity (≤3 per topic in 6)
→ ~10% exploration (seeded) → reason → log impressions**.

## Production seams

| Interface (`api/app/ports.py`) | Demo stand-in | Production |
|---|---|---|
| `ProfileStore` | Postgres JSONB row per HCP | Redis |
| `EventSink` | Postgres, same request | Kafka → warehouse |
| `CrmAdapter` | outbox + batch worker | IQVIA OCE / Salesforce LSC connector |
| `Ranker` | `FormulaRanker` | learning-to-rank model |

## Presenter runbook (one HCP, one story)

Open the launcher at `/`. Keep the engine lens open on the site (right panel).

1. **First visit.** Click *First visit*. Register the prefilled ophthalmologist (Saudi Arabia) and tick both
   consents live: personalisation and CRM sharing are opt-in. They land on Ophthalmology with *Start here*
   editor picks, then items popular with ophthalmologists in the same market. The lens shows 0% personal and a
   provisional cluster.
2. **Learning in action.** Read *Glaucoma essentials* (scroll past 60%) and watch *Measuring intraocular
   pressure*, pausing at about half. Back on the home page, the lists have changed, the article has dropped
   out, *Continue watching* resumes from where you paused, and reasons read "Because you read …".
3. **Therapy areas.** Open Cardiometabolic and read four articles. The landing TA flips on the **4th**
   (the lens shows the points still needed). All five TAs stay in the navigation.
4. **HCP clusters.** After 5 actions the HCP moves from the provisional cluster to the nearest real one.
   Show it on *Console → Clusters* (orange dot) and the *Popular with peers like you* row.
5. **IQVIA OCE.** Open *Mock OCE*: the HCP's engagement and current recommendations arrive within seconds
   (production: 15-minute batches). Toggle *Raw payload*.

Contrast personas (launcher): long-history cardiologist · registered-not-verified (no promotional content
anywhere, direct links return 403) · no CRM consent (never appears in OCE) · anonymous visitor.
Stage controls: *Engine down* (site falls back to editor lists), *Pause personalisation*, *Reset* (deletes only
rows from the current demo run). *Console → Content & rules → Expire* removes an item on the next request.

The demo-script test replays this story and asserts every claim above. It runs against its own database
(`hcp_test`), so it never touches a live demo. Run it after any weight or data change:

```
cd api && uv run python -m pytest -q         # or from the root: .\run.cmd -Test
```

Registration verifies the licence number through a stand-in for the professional-register lookup
(`app/demo.py: verify_licence`); a registered-but-unverified HCP sees non-promotional content only.

Latency: recommendation ranking takes 2–5 ms and `/home` p95 is about 40 ms measured sequentially on a laptop
with one worker. The production target (p95 < 150 ms at 2,000 concurrent users) is met by scaling the stateless
API horizontally with the profile store in Redis; it is not claimed for this single-process demo.

## Run

```
.\run.cmd                  # Postgres :5433 · seed · API :8000 · web :5173, opens the launcher
.\run.cmd -Test            # run the test suite first; the stack starts only if it passes
.\run.cmd -Reseed          # rebuild embeddings, sample HCPs and clusters (~5 min)
.\run.cmd -Reseed -Media   # also re-run the video pipeline (~12 min)
.\run.cmd -Stop            # stop everything
```

Every start reloads the seed into Postgres, so each rehearsal begins from the same clean state and the sample
history is recent. Seed data is rebuilt automatically when it is missing or older than the catalogue.
The API and web app run in their own windows, titled *Demo API* and *Demo web*.

First-time setup: Windows, [uv](https://docs.astral.sh/uv/) (`winget install astral-sh.uv`), Python 3.13, Node 22+,
portable Postgres 17 unpacked into `.local/pgsql`. `run.cmd` creates the database, the Python environment
(`uv sync`, from `api/uv.lock`) and installs web dependencies on first run.

Models (downloaded once into `.local/models`, never loaded by the API):
`BAAI/bge-m3` ONNX (embeddings) and Piper `en_US-lessac-medium` / `ar_JO-kareem-medium` (narration).
Fixed seeds everywhere: same clusters and lists every rehearsal.

## Notes

- Content is educational sample copy at guideline level; the client's medical team supplies approved content.
  Arabic copy should be reviewed by a medical translator before external use.
- Video footage: Mixkit stock clips (Mixkit licence), narrated offline; each clip's source is listed in
  `api/data/media_manifest.json`.
- Therapy areas other than Ophthalmology and all market rules are configurable placeholders (`api/seed/catalogue_src.py`).
