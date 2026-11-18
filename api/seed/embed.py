"""Item embeddings with BAAI/bge-m3 (multilingual; Arabic + English), run offline at seed time.

Both language versions of each item are embedded (title + summary + topic, plus the
transcript for videos) and averaged into one vector per item ID. Because the engine only
ever compares item vectors to item vectors, averaging avoids the known EN-query/AR-document
retrieval bias of cross-lingual matching.

Runs the official ONNX export with onnxruntime (CPU); no PyTorch needed. The API never loads
the model — it reads data/artifacts/item_embeddings.npy.

    python -m seed.embed --model-dir ../.local/models/bge-m3

Model files: https://huggingface.co/BAAI/bge-m3/tree/main/onnx (model.onnx, model.onnx_data,
tokenizer.json).
"""
from __future__ import annotations

import argparse
import json
import os
import time
from pathlib import Path

import numpy as np

from app.config import ARTIFACTS, catalogue_file, site_config

DEFAULT_MODEL_DIR = os.environ.get("BGE_M3_DIR", str(Path(__file__).resolve().parents[2] / ".local" / "models" / "bge-m3"))
MAX_LEN = 512


def item_text(it: dict, lang: str, cfg: dict) -> str:
    topic = cfg["topics"][it["topics"][0]][lang]
    ta = next(t[lang] for t in cfg["therapy_areas"] if t["id"] == it["therapy_area"])
    parts = [it["title"][lang], it["summary"][lang], f"{ta} · {topic}"]
    if it.get("transcript"):
        parts.append(it["transcript"][lang])
    if it.get("body"):
        parts += [s["text"] for s in it["body"][lang][:2]]
    return "\n".join(parts)


class BgeM3Onnx:
    def __init__(self, model_dir: str):
        import onnxruntime as ort
        from tokenizers import Tokenizer

        d = Path(model_dir)
        self.tok = Tokenizer.from_file(str(d / "tokenizer.json"))
        self.tok.enable_truncation(MAX_LEN)
        opts = ort.SessionOptions()
        opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        self.sess = ort.InferenceSession(str(d / "model.onnx"), opts, providers=["CPUExecutionProvider"])
        self.inputs = [i.name for i in self.sess.get_inputs()]
        self.outputs = [o.name for o in self.sess.get_outputs()]

    def encode(self, texts: list[str], batch: int = 8) -> np.ndarray:
        out = []
        for s in range(0, len(texts), batch):
            enc = self.tok.encode_batch(texts[s:s + batch])
            L = max(len(e.ids) for e in enc)
            ids = np.zeros((len(enc), L), dtype=np.int64)
            mask = np.zeros((len(enc), L), dtype=np.int64)
            for i, e in enumerate(enc):
                ids[i, :len(e.ids)] = e.ids
                mask[i, :len(e.ids)] = 1
            feeds = {"input_ids": ids, "attention_mask": mask}
            feeds = {k: v for k, v in feeds.items() if k in self.inputs}
            res = self.sess.run(None, feeds)
            named = dict(zip(self.outputs, res))
            if "sentence_embedding" in named:  # official export: CLS-pooled dense vector
                v = named["sentence_embedding"]
            elif "dense_vecs" in named:
                v = named["dense_vecs"]
            else:  # last_hidden_state → CLS pooling (bge-m3 dense retrieval uses CLS)
                h = res[0]
                v = h[:, 0, :] if h.ndim == 3 else h
            v = v / np.linalg.norm(v, axis=1, keepdims=True)
            out.append(v.astype(np.float32))
        return np.vstack(out)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model-dir", default=DEFAULT_MODEL_DIR)
    args = ap.parse_args()
    cfg = site_config()
    items = catalogue_file()["items"]
    t0 = time.time()
    m = BgeM3Onnx(args.model_dir)
    print(f"bge-m3 loaded in {time.time() - t0:.1f}s; outputs={m.outputs}")
    en = m.encode([item_text(it, "en", cfg) for it in items])
    ar = m.encode([item_text(it, "ar", cfg) for it in items])
    v = (en + ar) / 2.0
    v = v / np.linalg.norm(v, axis=1, keepdims=True)
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    np.save(ARTIFACTS / "item_embeddings.npy", v.astype(np.float32))
    xl = float(np.mean(np.sum(en * ar, axis=1)))
    meta = {"model": "BAAI/bge-m3", "runtime": "onnxruntime", "dim": int(v.shape[1]), "items": [it["item_id"] for it in items],
            "pooling": "dense (CLS), L2-normalised; EN and AR averaged per item",
            "mean_en_ar_cosine": round(xl, 4), "seconds": round(time.time() - t0, 1)}
    (ARTIFACTS / "item_embeddings.json").write_text(json.dumps(meta, indent=1), encoding="utf-8")
    print(f"embedded {len(items)} items × 2 languages → {v.shape}, mean EN↔AR cosine {xl:.3f}, {meta['seconds']}s")


if __name__ == "__main__":
    main()
