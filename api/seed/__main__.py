"""Run the full offline seed pipeline. All ML runs here; the API never loads a model.

    python -m seed                 # everything
    python -m seed --skip-media    # reuse downloaded clips
    python -m seed --skip-embed    # reuse item embeddings (bge-m3 takes ~3 min on CPU)
    python -m seed --load-only     # just (re)load artifacts into Postgres

Steps: catalogue → video pipeline → catalogue (merge) → bge-m3 embeddings → synthetic HCPs → HDBSCAN clusters → load.
Fixed seeds everywhere: same clusters and lists every rehearsal.
"""
from __future__ import annotations

import argparse
import time

from seed import build_catalogue, cluster, embed, load, media, synth


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--skip-media", action="store_true")
    ap.add_argument("--skip-embed", action="store_true")
    ap.add_argument("--load-only", action="store_true")
    a = ap.parse_args()
    t0 = time.time()
    if not a.load_only:
        build_catalogue.main()
        if not a.skip_media:
            media.main()
            build_catalogue.main()  # merge the pipeline output (durations, versions, transcripts)
        if not a.skip_embed:
            import sys
            sys.argv = sys.argv[:1]
            embed.main()
        synth.main()
        cluster.main()
    load.main()
    print(f"seed complete in {time.time() - t0:.0f}s")


if __name__ == "__main__":
    main()
