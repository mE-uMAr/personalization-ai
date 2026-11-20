"""Video ingestion pipeline (demo).

Production: every published video goes through ingest → transcode → probe → keyframes →
ASR transcript → chapters → embedding. In the demo:

  REAL       ingest (download + checksum), probe (duration, resolution, fps via OpenCV),
             keyframe/poster extraction (OpenCV), embedding (bge-m3, in seed.embed)
  SIMULATED  transcript and chapters — the sample clips are licensed stock footage with no
             narration, so the transcript is a placeholder that production replaces with ASR
             output (e.g. a self-hosted Whisper model) on the client's real videos.

Clips: Mixkit stock video (https://mixkit.co/license/#videoFree), stored under api/media so the
demo runs offline. Article cards get stills extracted from topic-matched clips.

    python -m seed.media
"""
from __future__ import annotations

import hashlib
import json
import time
import urllib.request
from pathlib import Path

import cv2
import numpy as np

from app.config import DATA, ROOT
from seed import narrate
from seed.catalogue_src import ITEMS
from seed.content_src import SECTIONS, SUMMARIES
from seed.content_unique import UNIQUE_BODIES

MEDIA = ROOT.parent / "web" / "public" / "media"  # served as static files by the web app
SRC_ROOT = ROOT / "media"
SRC = SRC_ROOT / "src"  # downloaded source clips (not committed)
LICENSE_URL = "https://mixkit.co/license/#videoFree"

# item → (mixkit clip id, clip name, licence notice as published by Mixkit)
VIDEO_SOURCES = {
    "OPH-002": (48017, "Green eye pupil dilating", "Mixkit Restricted License"),
    "OPH-004": (46741, "Close up of a blue eye", "Mixkit Restricted License"),
    "OPH-006": (6127, "Doctor showing scan results on a tablet", "Mixkit Restricted License"),
    "OPH-009": (20843, "Closeup of a dark grey eye", "Mixkit Restricted License"),
    "OPH-012": (47504, "Filling an injection with a saline solution", "Mixkit Restricted License"),
    "OPH-014": (4257, "Green eye blinking", "Free"),
    "CMD-002": (46368, "Close up of vital signs of a patient", "Mixkit Restricted License"),
    "CMD-005": (46365, "Close up of a heart rate monitor", "Mixkit Restricted License"),
    "CMD-008": (34235, "Lot of pills and capsules turning", "Mixkit Restricted License"),
    "CMD-009": (48888, "Doctor preparing a needle injection", "Mixkit Restricted License"),
    "CMD-011": (32071, "Female doctor is preparing an injection syringe", "Mixkit Restricted License"),
    "CMD-015": (49226, "Heartbeat on a monitor", "Mixkit Restricted License"),
    "RES-002": (5959, "Doctor talking with a sick man", "Mixkit Restricted License"),
    "RES-004": (5697, "Different medications", "Mixkit Restricted License"),
    "RES-006": (5820, "Nurse sitting with a patient", "Mixkit Restricted License"),
    "RES-010": (32072, "Preparing a vaccine syringe", "Mixkit Restricted License"),
    "RES-013": (33771, "Female doctor looking at an x-ray of lungs", "Mixkit Restricted License"),
    "RES-014": (47784, "Virologist making a test of the new vaccine", "Mixkit Restricted License"),
    "NEU-002": (5665, "Scientist looks at 3D brain model on computer screen", "Mixkit Restricted License"),
    "NEU-004": (35377, "Conceptual video of medical pills", "Mixkit Restricted License"),
    "NEU-006": (17540, "Doctor writing prescription", "Mixkit Restricted License"),
    "NEU-009": (5642, "Doctor shows patient brain scan on large screen", "Mixkit Restricted License"),
    "NEU-012": (46366, "Close up of an IV drip", "Mixkit Restricted License"),
    "NEU-014": (9339, "Artist drawing a human brain", "Mixkit Restricted License"),
    "NEU-016": (5492, "Sick man chats with nurse giving him medication", "Mixkit Restricted License"),
    "WMH-002": (5568, "Nurse talks with woman laying in hospital bed", "Mixkit Restricted License"),
    "WMH-006": (17469, "Doctor writing on a medical record", "Mixkit Restricted License"),
    "WMH-009": (48385, "Doctor writes patient records", "Mixkit Restricted License"),
    "WMH-010": (33734, "Doctor filling a syringe with anesthesia", "Mixkit Restricted License"),
    "WMH-012": (22999, "Four scientists talking about research", "Mixkit Restricted License"),
    "WMH-013": (16075, "Woman hands taking a pill", "Mixkit Restricted License"),
}

# stills for article cards, per therapy area (extra clips used only for posters)
ARTICLE_POOLS = {
    "ophthalmology": [48017, 46741, 20843, 4257, 6127, 47783],
    "cardiometabolic": [46365, 49226, 46368, 2856, 17540, 46747],
    "respiratory": [33771, 5959, 47784, 3955, 32072, 5820],
    "neuroscience": [5665, 5642, 9339, 5580, 23618, 35377],
    "womens_health": [5568, 17469, 16075, 48385, 4719, 22999],
}

TA_PREFIX = {"ophthalmology": "OPH", "cardiometabolic": "CMD", "respiratory": "RES",
             "neuroscience": "NEU", "womens_health": "WMH"}


def _download(clip: int) -> Path:
    SRC.mkdir(parents=True, exist_ok=True)
    p = SRC / f"{clip}.mp4"
    if not p.exists() or p.stat().st_size < 10_000:
        url = f"https://assets.mixkit.co/videos/{clip}/{clip}-360.mp4"
        req = urllib.request.Request(url, headers={"User-Agent": "hcp-demo-media-pipeline/1.0"})
        with urllib.request.urlopen(req, timeout=120) as r:
            p.write_bytes(r.read())
    return p


def probe(path: Path) -> dict:
    cap = cv2.VideoCapture(str(path))
    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    w, h = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    cap.release()
    return {"fps": round(fps, 3), "frames": frames, "width": w, "height": h,
            "duration_seconds": round(frames / fps, 2) if fps else None}


def keyframe(path: Path, at: float, out: Path, width: int = 960) -> None:
    cap = cv2.VideoCapture(str(path))
    n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    cap.set(cv2.CAP_PROP_POS_FRAMES, max(0, min(n - 1, int(n * at))))
    ok, frame = cap.read()
    cap.release()
    if not ok:
        raise RuntimeError(f"no frame from {path}")
    h, w = frame.shape[:2]
    frame = cv2.resize(frame, (width, int(h * width / w)), interpolation=cv2.INTER_AREA)
    out.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(out), frame, [cv2.IMWRITE_JPEG_QUALITY, 84])


def main() -> None:
    t0 = time.time()
    (MEDIA / "videos").mkdir(parents=True, exist_ok=True)
    (MEDIA / "posters").mkdir(parents=True, exist_ok=True)
    counters: dict[str, int] = {}
    manifest = {}
    article_n: dict[str, int] = {}
    topic_n: dict[str, int] = {}
    import imageio_ffmpeg
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    for old in (MEDIA / "videos").glob("*.mp4"):
        if old.name.count(".") == 1:  # remove silent single-language files from earlier runs
            old.unlink()
    for ta, topic, typ, en_title, ar_title, _f in ITEMS:
        counters[ta] = counters.get(ta, 0) + 1
        iid = f"{TA_PREFIX[ta]}-{counters[ta]:03d}"
        k = topic_n.get(topic, 0)  # same section rotation as seed.build_catalogue
        topic_n[topic] = k + 1
        pool = SECTIONS[topic]
        picked = UNIQUE_BODIES.get(en_title) or [pool[(k + j) % len(pool)] for j in range(min(3, len(pool)))]
        if typ == "video":
            clip, name, notice = VIDEO_SOURCES[iid]
            src = _download(clip)
            data = src.read_bytes()
            src_meta = probe(src)
            keyframe(src, 0.35, MEDIA / "posters" / f"{iid}.jpg")
            s_en, s_ar = SUMMARIES[en_title]
            versions, transcript = {}, {}
            for lang, title, summ in (("en", en_title, s_en), ("ar", ar_title, s_ar)):
                secs = [(h, t) if lang == "en" else (ha, ta_) for h, t, ha, ta_ in picked[:3]]
                lines, titles = narrate.script(lang, title, summ, secs)
                mp4 = MEDIA / "videos" / f"{iid}.{lang}.mp4"
                vtt = MEDIA / "captions" / f"{iid}.{lang}.vtt"
                vtt.parent.mkdir(parents=True, exist_ok=True)
                v = narrate.build_version(lang, lines, titles, src, mp4, vtt, ffmpeg)
                pm = probe(mp4)
                versions[lang] = {"file": f"/media/videos/{iid}.{lang}.mp4", "captions": f"/media/captions/{iid}.{lang}.vtt",
                                  "duration_seconds": v["duration_seconds"], "chapters": v["chapters"],
                                  "bytes": mp4.stat().st_size, "width": pm["width"], "height": pm["height"]}
                transcript[lang] = v["transcript"]
            manifest[iid] = {
                "type": "video",
                "source": {"provider": "Mixkit", "clip_id": clip, "clip_name": name, "license": notice,
                           "license_url": LICENSE_URL, "url": f"https://mixkit.co/free-stock-video/{clip}/"},
                "poster": f"/media/posters/{iid}.jpg", "sha256": hashlib.sha256(data).hexdigest(),
                "versions": versions, "transcript": transcript,
                "duration_seconds": versions["en"]["duration_seconds"],
                "pipeline": [
                    {"step": "ingest", "mode": "real", "detail": f"Source clip downloaded and checksummed ({len(data) // 1024} KB)"},
                    {"step": "probe", "mode": "real", "detail": f"{src_meta['width']}×{src_meta['height']} · {src_meta['fps']} fps"},
                    {"step": "keyframes", "mode": "real", "detail": "Poster extracted at 35%"},
                    {"step": "transcript", "mode": "simulated", "detail": "From editorial copy; production runs self-hosted ASR on the real audio"},
                    {"step": "narration", "mode": "real", "detail": "Offline neural TTS (Piper) in Arabic and English"},
                    {"step": "captions", "mode": "real", "detail": "WebVTT from real sentence timings, AR + EN"},
                    {"step": "transcode", "mode": "real", "detail": "H.264/AAC 640p, faststart, one file per language"},
                    {"step": "embedding", "mode": "real", "detail": "bge-m3 on title + summary + transcript (AR & EN)"},
                ],
            }
        else:
            k = article_n.get(ta, 0)
            article_n[ta] = k + 1
            pool = ARTICLE_POOLS[ta]
            clip = pool[k % len(pool)]
            src = _download(clip)
            at = 0.15 + 0.7 * ((k * 0.37) % 1.0)  # vary the still between articles sharing a clip
            keyframe(src, at, MEDIA / "posters" / f"{iid}.jpg")
            manifest[iid] = {"type": "article", "poster": f"/media/posters/{iid}.jpg",
                             "poster_source": {"provider": "Mixkit", "clip_id": clip, "license_url": LICENSE_URL}}
        print(f"  {iid} ok", flush=True)
    (DATA / "media_manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding="utf-8")
    vids = [m for m in manifest.values() if m["type"] == "video"]
    mb = sum(v["bytes"] for m in vids for v in m["versions"].values()) / 1e6
    print(f"media: {len(vids)} videos x 2 languages ({mb:.1f} MB, avg EN {np.mean([m['versions']['en']['duration_seconds'] for m in vids]):.0f}s / "
          f"AR {np.mean([m['versions']['ar']['duration_seconds'] for m in vids]):.0f}s), {len(manifest) - len(vids)} article posters "
          f"in {time.time() - t0:.0f}s")


if __name__ == "__main__":
    main()
