"""Bilingual narrated video versions (requirements §4 bilingual linking).

One item ID, two language versions: the HCP sees the version in their chosen language and
engagement on either counts for the item. For each video item:

  1. narration script per language (EN, AR), sentence by sentence, grouped into 3 chapters
  2. offline neural TTS per sentence — Piper voices, self-hosted (no external AI API, §12)
  3. real sentence timings → WebVTT captions and chapter start times
  4. ffmpeg: loop the licensed clip to the narration length, mux H.264 + AAC, faststart

The script is the item's editorial copy (seed/content_src.py). In production the client's real
videos arrive with their own audio, and steps 1–2 are replaced by self-hosted ASR.
"""
from __future__ import annotations

import io
import subprocess
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
VOICES = {
    "en": ROOT / ".local" / "models" / "tts" / "vits-piper-en_US-lessac-medium" / "en_US-lessac-medium.onnx",
    "ar": ROOT / ".local" / "models" / "tts" / "vits-piper-ar_JO-kareem-medium" / "ar_JO-kareem-medium.onnx",
}
GAP = 0.45  # seconds of silence between sentences


def script(lang: str, title: str, summary: str, sections: list[tuple[str, str]]) -> tuple[list[tuple[int, str]], list[str]]:
    """Narration lines as (chapter index, sentence), plus chapter titles.
    Chapter 0 is the introduction; then one chapter per article section."""
    intro = "Introduction" if lang == "en" else "مقدمة"
    lines = [(0, f"{title}."), (0, summary)]
    titles = [intro]
    for i, (heading, text) in enumerate(sections, start=1):
        titles.append(heading)
        for sent in [x.strip() for x in text.replace("؟", "؟|").split(". ") if x.strip()]:
            sent = sent.rstrip("|")
            lines.append((i, sent if sent.endswith((".", "؟", "!")) else sent + "."))
    return lines, titles


_voices: dict = {}


def _voice(lang: str):
    if lang not in _voices:
        from piper import PiperVoice
        _voices[lang] = PiperVoice.load(str(VOICES[lang]))
    return _voices[lang]


def synth(lang: str, text: str) -> tuple[np.ndarray, int]:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        _voice(lang).synthesize_wav(text, w)
    buf.seek(0)
    with wave.open(buf) as w:
        sr = w.getframerate()
        pcm = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16)
    return pcm, sr


def _vtt_time(t: float) -> str:
    h, rem = divmod(t, 3600)
    m, s = divmod(rem, 60)
    return f"{int(h):02d}:{int(m):02d}:{s:06.3f}"


def build_version(lang: str, lines: list[tuple[int, str]], titles: list[str], clip: Path, out_mp4: Path,
                  out_vtt: Path, ffmpeg: str) -> dict:
    """Synthesize narration, write captions, mux the video. Returns timings + transcript."""
    lead = 0.8
    sr = None
    parts, cues, chapters = [], [], {}
    t = lead
    for ch, sentence in lines:
        pcm, sr = synth(lang, sentence)
        dur = len(pcm) / sr
        chapters.setdefault(ch, round(max(0.0, t - lead), 2))
        cues.append((t, t + dur, sentence))
        parts.append(pcm)
        parts.append(np.zeros(int(GAP * sr), dtype=np.int16))
        t += dur + GAP
    audio = np.concatenate([np.zeros(int(lead * sr), dtype=np.int16), *parts, np.zeros(int(1.2 * sr), dtype=np.int16)])
    total = len(audio) / sr

    wav = out_mp4.with_suffix(".wav")
    with wave.open(str(wav), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(audio.tobytes())

    out_vtt.write_text("WEBVTT\n\n" + "\n".join(
        f"{i + 1}\n{_vtt_time(a)} --> {_vtt_time(b)}\n{txt}\n" for i, (a, b, txt) in enumerate(cues)), encoding="utf-8")

    fade_out = max(0.0, total - 0.8)
    cmd = [ffmpeg, "-y", "-loglevel", "error", "-stream_loop", "-1", "-i", str(clip), "-i", str(wav),
           "-map", "0:v:0", "-map", "1:a:0", "-t", f"{total:.2f}",
           "-vf", f"scale=640:-2,fps=25,fade=t=in:st=0:d=0.6,fade=t=out:st={fade_out:.2f}:d=0.8",
           "-c:v", "libx264", "-preset", "veryfast", "-crf", "26", "-pix_fmt", "yuv420p", "-profile:v", "main",
           "-c:a", "aac", "-b:a", "96k", "-ar", "44100", "-ac", "1",
           "-movflags", "+faststart", str(out_mp4)]
    subprocess.run(cmd, check=True)
    wav.unlink(missing_ok=True)
    return {
        "duration_seconds": round(total, 2),
        "transcript": " ".join(s for _, s in lines),
        "chapters": [{"start": chapters[i], "title": titles[i]} for i in sorted(chapters)],
        "cues": len(cues),
    }
