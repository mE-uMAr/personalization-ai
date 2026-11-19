// Video player that tracks real viewing progress: seconds actually played, not playhead
// position. Dragging the slider to the end does not count as watched.
import { useEffect, useRef, useState } from "react"
import { ListVideo } from "lucide-react"
import type { VideoInfo } from "@/lib/api"
import { fmtDuration, useT } from "@/lib/i18n"
import { track } from "@/lib/track"
import { cn } from "@/lib/utils"

const MILESTONES = [25, 50, 75, 100] as const

export function VideoPlayer({ itemId, video, initialProgress }: { itemId: string; video: VideoInfo; initialProgress: number }) {
  const { t, lang } = useT()
  const ref = useRef<HTMLVideoElement>(null)
  const watched = useRef<Set<number>>(new Set())
  const last = useRef<number | null>(null)
  const fired = useRef<Set<number>>(new Set(MILESTONES.filter((m) => m <= initialProgress)))
  const started = useRef(false)
  const [cur, setCur] = useState(0)

  useEffect(() => {
    watched.current = new Set()
    last.current = null
    started.current = false
  }, [video.file])

  // captions in the viewer's language only (the other language stays available in the menu)
  const syncCaptions = () => {
    const v = ref.current
    if (!v) return
    Array.from(v.textTracks).forEach((tt) => {
      tt.mode = tt.language === lang ? "showing" : "disabled"
    })
  }
  useEffect(syncCaptions)

  const onTime = () => {
    const v = ref.current
    if (!v) return
    setCur(v.currentTime)
    const now = v.currentTime
    const prev = last.current
    last.current = now
    if (v.paused || v.seeking || prev === null) return
    const dt = now - prev
    if (dt <= 0 || dt > 1.5 * Math.max(1, v.playbackRate)) return // a seek, not playback
    for (let s = Math.floor(prev * 4); s < Math.floor(now * 4); s++) watched.current.add(s) // quarter-second buckets
    const dur = v.duration || video.duration_seconds
    const p = Math.min(100, Math.round((watched.current.size / 4 / dur) * 100))
    for (const m of MILESTONES) {
      const reached = m === 100 ? p >= 95 : p >= m
      if (reached && !fired.current.has(m)) {
        fired.current.add(m)
        track("video_progress", itemId, m)
      }
    }
  }

  return (
    <div className="@container overflow-hidden rounded-2xl bg-black shadow-xl ring-1 ring-black/5">
      <video
        ref={ref}
        key={video.file}
        controls
        playsInline
        preload="metadata"
        poster={video.poster}
        className="aspect-video w-full bg-black"
        crossOrigin="anonymous"
        onPlay={() => {
          if (!started.current) {
            started.current = true
            track("video_start", itemId)
          }
          last.current = ref.current?.currentTime ?? 0
        }}
        onLoadedMetadata={() => {
          syncCaptions()
          const v = ref.current
          if (v && initialProgress >= 5 && initialProgress < 95) {
            const resumeAt = (initialProgress / 100) * v.duration
            for (let s = 0; s < Math.floor(resumeAt * 4); s++) watched.current.add(s) // already watched
            v.currentTime = resumeAt
          }
        }}
        onSeeking={() => (last.current = null)}
        onSeeked={() => (last.current = ref.current?.currentTime ?? null)}
        onTimeUpdate={onTime}
        onPause={() => {
          if (ref.current) track("time_spent", itemId, Math.round(watched.current.size / 4))
        }}
      >
        <source src={video.file} type="video/mp4" />
        <track kind="captions" src={video.captions} srcLang={video.language} label={video.language === "ar" ? "العربية" : "English"} />
        <track kind="captions" src={video.captions_alt} srcLang={video.language === "ar" ? "en" : "ar"} label={video.language === "ar" ? "English" : "العربية"} />
      </video>
      {video.chapters.length > 0 && (
        <div className="bg-[#0b1233] px-4 pb-4 pt-3">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-white/45"><ListVideo className="size-3.5" />{t("chapters")}</div>
          <div className="grid gap-1.5 @lg:grid-cols-2 @3xl:grid-cols-3">
            {video.chapters.map((c, i) => {
              const next = video.chapters[i + 1]?.start ?? video.duration_seconds
              const active = cur >= c.start && cur < next
              return (
                <button
                  key={c.start}
                  onClick={() => {
                    if (ref.current) ref.current.currentTime = c.start
                  }}
                  className={cn("flex items-center justify-between gap-2 rounded-md px-3 py-2 text-start text-xs transition", active ? "bg-white/15 text-white" : "bg-white/[0.05] text-white/70 hover:bg-white/10")}
                >
                  <span className="line-clamp-2">{c.title}</span>
                  <span className="num text-white/45">{fmtDuration(c.start, lang) || "0:00"}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
