import { useEffect, useRef, useState } from "react"
import { Link, useParams } from "react-router"
import { ArrowLeft, BadgeCheck, Bookmark, BookmarkCheck, CheckCircle2, FileText, Lock, Megaphone, PlayCircle } from "lucide-react"
import { RecRow } from "@/components/rec-row"
import { TaDot } from "@/components/brand"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ApiError, type ItemDetail } from "@/lib/api"
import { useConfig, useItem } from "@/lib/hooks"
import { fmtDate, fmtDuration, readMinutes, useT } from "@/lib/i18n"
import { useSession } from "@/lib/session"
import { track } from "@/lib/track"
import { cn } from "@/lib/utils"
import { VideoPlayer } from "./VideoPlayer"

export default function ItemPage() {
  const { id = "" } = useParams()
  const { t, lang } = useT()
  const { hcpId } = useSession()
  const q = useItem(id)
  const cfg = useConfig()
  const opened = useRef<string | null>(null)
  const [saved, setSaved] = useState(false)

  // one item_open per page view (and per language version — same item ID)
  useEffect(() => {
    if (q.data && opened.current !== id) {
      opened.current = id
      track("item_open", id)
    }
  }, [q.data, id, lang])

  if (q.isLoading) return <div className="mx-auto max-w-6xl px-6 py-10"><Skeleton className="aspect-video w-full rounded-2xl" /></div>
  if (q.isError) {
    const e = q.error as ApiError
    const rule = ((e.detail ?? {}) as { rule?: string }).rule
    const gated = !hcpId && rule === "gated_anonymous"
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <div className="mx-auto grid size-14 place-items-center rounded-full bg-brand-50"><Lock className="size-6 text-brand-700" /></div>
        <h1 className="mt-5 font-heading text-2xl">{gated ? t("register_to_read") : t("not_available")}</h1>
        {gated && <p className="mt-2 text-sm text-muted-foreground">{t("register_to_read_sub")}</p>}
        <div className="mt-6 flex justify-center gap-2">
          {gated && <Button asChild className="bg-ember-500 hover:bg-ember-600"><Link to="/site/register">{t("register")}</Link></Button>}
          <Button asChild variant="outline"><Link to="/site">{t("back")}</Link></Button>
        </div>
      </div>
    )
  }
  const it = q.data!.item
  const ta = cfg?.therapy_areas.find((x) => x.id === it.therapy_area)

  return (
    <div>
      <div className="mx-auto max-w-6xl px-6 pt-6">
        <Link to={`/site/ta/${it.therapy_area}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-brand-700">
          <ArrowLeft className="size-4 rtl:rotate-180" /> {ta?.[lang]}
        </Link>
      </div>
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <article className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
            {ta && <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 font-medium ring-1 ring-border"><TaDot color={ta.color} />{ta[lang]}</span>}
            <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-border">{cfg?.topics[it.topic]?.[lang]}</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 ring-1 ring-border">
              {it.type === "video" ? <PlayCircle className="size-3.5" /> : <FileText className="size-3.5" />}
              {it.type === "video" ? `${t("video")} · ${fmtDuration(it.video?.duration_seconds, lang)}` : `${readMinutes(it.word_count)} ${t("min_read")}`}
            </span>
            {it.promotional && <span className="inline-flex items-center gap-1 rounded-full bg-ember-50 px-2.5 py-1 font-medium text-ember-600 ring-1 ring-ember-500/20"><Megaphone className="size-3.5" />{t("promotional")}</span>}
          </div>
          <h1 className="font-heading text-[32px] leading-[1.2] sm:text-[38px]">{it.title}</h1>
          <p className="mt-3 text-[17px] leading-relaxed text-muted-foreground">{it.summary}</p>
          <div className="mt-5 flex items-center gap-2">
            {hcpId && (
              <Button variant="outline" size="sm" onClick={() => { if (!saved) { setSaved(true); track("save", it.item_id) } }}>
                {saved ? <BookmarkCheck className="size-4 text-brand-700" /> : <Bookmark className="size-4" />}
                {saved ? t("saved") : t("save")}
              </Button>
            )}
          </div>

          <div className="mt-8">
            {it.type === "video" && it.video ? (
              <>
                <VideoPlayer itemId={it.item_id} video={it.video} initialProgress={it.progress} />
                {it.transcript && (
                  <section className="mt-8">
                    <h2 className="font-heading text-xl">{t("transcript")}</h2>
                    <p className="mt-3 leading-loose text-foreground/85">{it.transcript}</p>
                  </section>
                )}
              </>
            ) : (
              <ArticleBody item={it} />
            )}
          </div>
        </article>

        <aside className="space-y-4 lg:pt-14">
          <div className="rounded-xl border bg-white p-4 text-sm">
            <div className="flex items-center gap-2 font-medium"><BadgeCheck className="size-4 text-brand-600" />{lang === "ar" ? "معلومات الاعتماد" : "Approval information"}</div>
            <dl className="mt-3 space-y-2 text-xs">
              <Row k={t("approval")} v={<span className="font-mono">{it.approval_code}</span>} />
              <Row k={lang === "ar" ? "تاريخ النشر" : "Published"} v={<span className="num">{fmtDate(it.published_date, lang)}</span>} />
              <Row k={t("valid_until")} v={<span className="num">{fmtDate(it.expiry_date, lang)}</span>} />
            </dl>
          </div>
          {it.promotional && (
            <div className="rounded-xl border border-ember-500/25 bg-ember-50/50 p-4 text-xs leading-relaxed">
              <div className="mb-1.5 text-sm font-medium">{t("pi_title")}</div>
              <p className="text-foreground/80">{t("pi_text")}</p>
              <p className="mt-2 text-foreground/80">{t("ae_text")} <Link to="/site/info/side-effects" className="font-medium text-brand-700 underline">{t("nav_ae")}</Link></p>
            </div>
          )}
        </aside>
      </div>

      {q.data!.next.items.length > 0 && (
        <div className="mx-auto max-w-6xl px-6 pb-4 pt-6">
          <RecRow row={q.data!.next} cols={4} />
        </div>
      )}
    </div>
  )
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-end">{v}</dd>
    </div>
  )
}

// Reads scroll depth and active reading time. article_read fires past 60% scroll (with at
// least 6 s of active reading, so a flick-scroll doesn't count) or after a minimum read time (§6).
function ArticleBody({ item }: { item: ItemDetail }) {
  const { t, lang } = useT()
  const ref = useRef<HTMLDivElement>(null)
  const fired = useRef<Set<number>>(new Set())
  const readFired = useRef(item.completed)
  const active = useRef(0)
  const depthRef = useRef(0)
  const [depth, setDepth] = useState(0)
  const [read, setRead] = useState(item.completed)
  const minRead = Math.min(45, Math.max(20, (item.word_count ?? 1000) / 230 * 60 * 0.25))

  useEffect(() => {
    const onScroll = () => {
      const el = ref.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const seen = Math.min(1, Math.max(0, (window.innerHeight - r.top) / r.height))
      const p = Math.round(seen * 100)
      depthRef.current = Math.max(depthRef.current, p)
      setDepth(depthRef.current)
      for (const m of [25, 50, 75, 100]) {
        if (p >= m && !fired.current.has(m)) {
          fired.current.add(m)
          track("article_scroll", item.item_id, m)
        }
      }
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    onScroll()
    const tick = setInterval(() => {
      if (document.visibilityState === "visible") active.current += 1
      if (!readFired.current && ((depthRef.current >= 60 && active.current >= 6) || active.current >= minRead)) {
        readFired.current = true
        setRead(true)
        track("article_read", item.item_id, active.current)
      }
    }, 1000)
    return () => {
      window.removeEventListener("scroll", onScroll)
      clearInterval(tick)
      if (active.current > 2) track("time_spent", item.item_id, active.current)
    }
  }, [item.item_id, minRead, lang])

  return (
    <div>
      <div className="sticky top-16 z-10 -mx-1 mb-6 flex items-center gap-3 bg-background/90 px-1 py-2 backdrop-blur">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-ember-500 transition-all" style={{ width: `${depth}%` }} />
        </div>
        <span className={cn("inline-flex items-center gap-1 text-xs num", read ? "text-emerald-700" : "text-muted-foreground")}>
          {read && <CheckCircle2 className="size-3.5" />}
          {read ? t("completed") : `${t("read_progress")} ${depth}%`}
        </span>
      </div>
      {item.media?.poster && <img src={item.media.poster} alt="" className="mb-8 aspect-[16/8] w-full rounded-2xl object-cover" />}
      <div ref={ref} className="space-y-8">
        {item.body?.map((s, i) => (
          <section key={i}>
            <h2 className="font-heading text-[22px]">{s.heading}</h2>
            <p className="mt-2.5 text-[16.5px] leading-[1.85] text-foreground/85">{s.text}</p>
          </section>
        ))}
      </div>
    </div>
  )
}
