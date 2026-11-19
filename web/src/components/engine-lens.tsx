// Live insight panel: what the engine knows about one HCP and why it ranked what it ranked.
// Polls every 2 s so the room watches the engine learn. Bilingual; follows the caller's language.
import { useEffect, useRef, useState } from "react"
import { Activity, Gauge, Layers, Radio, ShieldCheck, Timer, Users, X } from "lucide-react"
import { LevelBadge, TaDot } from "@/components/brand"
import type { Lang, LensData } from "@/lib/api"
import { useConfig, useLens } from "@/lib/hooks"
import { cn } from "@/lib/utils"

// Segment order and colours checked for colour-blind separation
export const COMPONENT_ORDER = ["editor", "specialty_pop", "ta_affinity", "peer_pop", "content", "freshness"] as const
export const COMPONENT_COLOR: Record<string, string> = {
  editor: "#b07a12",
  specialty_pop: "#5f87f0",
  ta_affinity: "#0b3bc8",
  peer_pop: "#009e8f",
  content: "#6d3be8",
  related: "#6d3be8",
  freshness: "#c2337a",
}
export const COMPONENT_SHORT: Record<string, string> = {
  editor: "Editor pick",
  specialty_pop: "Specialty popularity",
  ta_affinity: "Therapy-area interest",
  peer_pop: "Peer popularity",
  content: "Content match",
  related: "Similarity",
  freshness: "Freshness",
}
const COMPONENT_AR: Record<string, string> = {
  editor: "اختيار المحرر",
  specialty_pop: "شائع في التخصص",
  ta_affinity: "الاهتمام بالمجال",
  peer_pop: "شائع بين الزملاء",
  content: "تطابق المحتوى",
  related: "التشابه",
  freshness: "الحداثة",
}

const EVENT_LABEL: Record<string, [string, string]> = {
  item_open: ["Opened", "فتح"],
  article_scroll: ["Scrolled", "تمرير"],
  article_read: ["Read", "قرأ"],
  time_spent: ["Time spent", "الوقت المستغرق"],
  video_start: ["Started video", "بدأ الفيديو"],
  video_progress: ["Watched", "شاهد"],
  dismiss: ["Not relevant", "غير مناسب"],
  save: ["Saved", "حفظ"],
  search: ["Searched", "بحث"],
}

function ago(ts: string, ar: boolean) {
  const s = Math.max(0, (Date.now() - new Date(ts).getTime()) / 1000)
  const [v, u] = s < 60 ? [Math.round(s), ar ? "ث" : "s"] : s < 3600 ? [Math.round(s / 60), ar ? "د" : "m"] : s < 86400 ? [Math.round(s / 3600), ar ? "س" : "h"] : [Math.round(s / 86400), ar ? "ي" : "d"]
  return `${v}${u}`
}

function evValue(e: LensData["events"][number]) {
  if (!e.value) return ""
  if (e.event_type === "video_progress" || e.event_type === "article_scroll") return `${e.value}%`
  if (e.event_type === "time_spent" || e.event_type === "article_read") return `${e.value}s`
  return e.value
}

function Section({ icon: Icon, title, right, children, className }: { icon: React.ElementType; title: string; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("border-b border-black/[0.06] px-5 py-4", className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-[12px] font-semibold text-foreground/70">
          <Icon className="size-3.5 text-brand-600" />
          {title}
        </h3>
        {right}
      </div>
      {children}
    </section>
  )
}

export function StackBar({ components, max, height = 8 }: { components: Record<string, number>; max: number; height?: number }) {
  const keys = [...COMPONENT_ORDER, "related"].filter((k) => (components[k] ?? 0) > 0)
  return (
    <div className="flex w-full gap-[2px] overflow-hidden rounded-full bg-[#eef0f6]" style={{ height }}>
      {keys.map((k) => (
        <div
          key={k}
          title={`${COMPONENT_SHORT[k]} ${components[k].toFixed(3)}`}
          className="h-full first:rounded-s-full last:rounded-e-full"
          style={{ width: `${(components[k] / (max || 1)) * 100}%`, background: COMPONENT_COLOR[k] }}
        />
      ))}
    </div>
  )
}

export function EngineLens({ hcpId, onClose, className, lang = "en" }: { hcpId: string | null; onClose?: () => void; className?: string; lang?: Lang }) {
  const { data, isLoading } = useLens(hcpId)
  const cfg = useConfig()
  const ar = lang === "ar"
  const L = (en: string, a: string) => (ar ? a : en)
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set())
  const seen = useRef<Set<string>>(new Set())
  const [landingFlash, setLandingFlash] = useState(false)
  const prevLanding = useRef<string | null>(null)

  useEffect(() => {
    if (!data) return
    const fresh = data.events.filter((e) => !seen.current.has(e.event_id)).map((e) => e.event_id)
    if (seen.current.size && fresh.length) {
      setFlashIds(new Set(fresh))
      const t = setTimeout(() => setFlashIds(new Set()), 1800)
      fresh.forEach((f) => seen.current.add(f))
      return () => clearTimeout(t)
    }
    data.events.forEach((e) => seen.current.add(e.event_id))
  }, [data])

  useEffect(() => {
    if (!data) return
    if (prevLanding.current && prevLanding.current !== data.landing_ta) {
      setLandingFlash(true)
      setTimeout(() => setLandingFlash(false), 2600)
    }
    prevLanding.current = data.landing_ta
  }, [data])

  const taName = (id: string) => cfg?.therapy_areas.find((t) => t.id === id)?.[lang] ?? id
  const steps = cfg?.engine.cold_start_actions ?? 5

  return (
    <aside className={cn("flex h-full flex-col overflow-hidden bg-white text-foreground", className)} dir={ar ? "rtl" : "ltr"} lang={lang}>
      <div className="flex items-center justify-between gap-3 border-b border-black/[0.06] px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
          </span>
          <div>
            <div className="text-sm font-semibold tracking-tight">{L("Live engine insight", "رؤية مباشرة للمحرك")}</div>
            <div className="text-[11px] text-muted-foreground">{L("Updates as the HCP engages", "تتحدث مع كل تفاعل للطبيب")}</div>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={L("Close", "إغلاق")}>
            <X className="size-4" />
          </button>
        )}
      </div>

      {!hcpId && <div className="p-6 text-sm text-muted-foreground">{L("Register or choose an HCP to watch the engine learn.", "سجّل أو اختر طبيباً لمشاهدة تعلّم المحرك.")}</div>}
      {hcpId && isLoading && <div className="p-6 text-sm text-muted-foreground">{L("Loading…", "جارٍ التحميل…")}</div>}
      {data && (
        <div className="scrollbar-thin flex-1 overflow-y-auto">
          <div className="flex flex-wrap gap-1.5 border-b border-black/[0.06] px-5 py-3 text-[11px]">
            <Chip ok>{cfg?.specialties[data.hcp.specialty]?.[lang] ?? data.hcp.specialty} · {cfg?.countries[data.hcp.country]?.[lang] ?? data.hcp.country}</Chip>
            <Chip ok={data.hcp.verified}>{data.hcp.verified ? L("Verified", "موثّق") : L("Not verified", "غير موثّق")}</Chip>
            <Chip ok={data.hcp.tracking_consent}>{data.hcp.tracking_consent ? L("Personalisation on", "التخصيص مفعّل") : L("No personalisation consent", "بدون موافقة تخصيص")}</Chip>
            <Chip ok={data.hcp.crm_consent}>{data.hcp.crm_consent ? L("CRM sharing on", "المشاركة مع CRM مفعّلة") : L("No CRM consent", "بدون موافقة CRM")}</Chip>
            {(data.switches_state.engine_down || data.switches_state.paused) && (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-800 ring-1 ring-amber-200">
                {data.switches_state.engine_down ? L("Engine offline · editor lists", "المحرك متوقف · قوائم المحررين") : L("Personalisation paused", "التخصيص متوقف مؤقتاً")}
              </span>
            )}
          </div>

          <Section icon={Gauge} title={L("How personal the feed is", "مدى تخصيص المحتوى")} right={<span className="num text-xs font-semibold text-brand-700">{Math.round(data.alpha * 100)}%</span>}>
            <div className="flex gap-1">
              {Array.from({ length: steps }).map((_, i) => (
                <div key={i} className={cn("h-2 flex-1 rounded-full transition-colors duration-500", i < data.actions ? "bg-ember-500" : "bg-[#eef0f6]")} />
              ))}
            </div>
            <div className="mt-2 text-[11.5px] text-muted-foreground">
              {data.alpha >= 1
                ? L(`Fully personal after ${data.actions} actions`, `مخصص بالكامل بعد ${data.actions} تفاعلات`)
                : L(`${data.actions} of ${steps} actions · starts from specialty favourites`, `${data.actions} من ${steps} تفاعلات · يبدأ بالمحتوى الشائع في التخصص`)}
            </div>
          </Section>

          <Section icon={Layers} title={L("Therapy-area interest", "الاهتمام بالمجالات العلاجية")}>
            <div className={cn("mb-3 flex items-center justify-between rounded-xl bg-[#f5f6fa] px-3 py-2.5 transition", landingFlash && "pulse-ring bg-ember-50")}>
              <span className="text-[11.5px] text-muted-foreground">{L("Lands on", "يبدأ من")}</span>
              <span className="flex items-center gap-2 text-sm font-semibold">
                <TaDot color={data.ta[0]?.color ?? "#999"} />
                {taName(data.landing_ta)}
              </span>
            </div>
            <div className="space-y-2">
              {data.ta.map((t) => {
                const max = Math.max(...data.ta.map((x) => x.score), 1)
                return (
                  <div key={t.ta} className="grid grid-cols-[112px_1fr_36px] items-center gap-2 text-xs">
                    <span className="truncate text-foreground/80">{taName(t.ta)}</span>
                    <div className="h-1.5 rounded-full bg-[#eef0f6]">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(t.score / max) * 100}%`, background: t.color }} />
                    </div>
                    <span className="num text-end text-muted-foreground">{t.score.toFixed(1)}</span>
                  </div>
                )
              })}
            </div>
            {(() => {
              const order = data.ta.map((x) => x.ta)
              const [nextTa, gap] = Object.entries(data.switch_gap).sort((a, b) => a[1] - b[1] || order.indexOf(a[0]) - order.indexOf(b[0]))[0] ?? []
              return nextTa ? (
                <p className="mt-3 text-[11.5px] leading-relaxed text-muted-foreground">
                  <span className="font-medium text-foreground">{taName(nextTa)}</span>{" "}
                  {L("takes over after", "يتصدّر بعد")} <span className="num font-semibold text-ember-600">+{gap}</span> {L("more points (one read ≈ 4)", "نقاط إضافية (القراءة ≈ 4)")}
                </p>
              ) : null
            })()}
          </Section>

          <Section icon={Users} title={L("Peer segment", "شريحة الزملاء")}>
            {data.cluster ? (
              <div className="rounded-xl bg-[#f5f6fa] p-3">
                <div className="text-sm font-semibold leading-snug">{ar ? data.cluster.label_ar : data.cluster.label_en}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="num">{data.cluster.size} {L("similar HCPs", "طبيباً مشابهاً")}</span>
                  <span className={cn("rounded-full px-2 py-0.5 font-medium", data.cluster.source === "assigned" ? "bg-emerald-50 text-emerald-700" : data.cluster.source === "provisional" ? "bg-amber-50 text-amber-800" : "bg-white text-foreground/70")}>
                    {data.cluster.source === "assigned" ? L("Matched by behaviour", "مطابقة حسب السلوك") : data.cluster.source === "provisional" ? L("Provisional · by specialty", "مؤقت · حسب التخصص") : L("Segmented", "مصنّف")}
                  </span>
                </div>
                {data.cluster.source === "provisional" && !data.hcp.synthetic && (
                  <div className="mt-1.5 text-[11px] text-muted-foreground">{L(`Matched by behaviour after ${data.cluster_assign_at} actions`, `تتم المطابقة حسب السلوك بعد ${data.cluster_assign_at} تفاعلات`)}</div>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">{L("No segment: behaviour is not stored without consent.", "لا توجد شريحة: لا يُخزَّن السلوك دون موافقة.")}</p>
            )}
          </Section>

          <RankingSection data={data} lang={lang} />

          <Section icon={Radio} title={L("Live activity", "النشاط المباشر")}>
            {data.events.length === 0 ? (
              <p className="text-xs text-muted-foreground">{L("No activity yet.", "لا يوجد نشاط بعد.")}</p>
            ) : (
              <ol className="space-y-1">
                {data.events.slice(0, 10).map((e) => (
                  <li key={e.event_id} className={cn("grid grid-cols-[1fr_auto] gap-2 rounded-lg px-2.5 py-1.5 text-xs transition-colors", flashIds.has(e.event_id) ? "bg-ember-50" : "bg-[#f7f8fb]")}>
                    <span className="min-w-0 truncate">
                      <span className="font-medium">{(EVENT_LABEL[e.event_type] ?? [e.event_type, e.event_type])[ar ? 1 : 0]}</span>
                      {evValue(e) && <span className="num text-ember-600"> {evValue(e)}</span>}
                      {e.title && <span className="text-muted-foreground"> · {e.title}</span>}
                    </span>
                    <span className="num text-muted-foreground/70">{ago(e.ts, ar)}</span>
                  </li>
                ))}
              </ol>
            )}
          </Section>

          <Section icon={ShieldCheck} title={L("Compliance & CRM", "الامتثال وCRM")} className="border-b-0">
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <Stat label={L("Eligible content", "محتوى مؤهل")} value={`${data.eligible}`} sub={L(`${Object.keys(data.removed).length} hidden by market rules`, `${Object.keys(data.removed).length} مخفي بقواعد السوق`)} />
              <Stat label={L("Sent to CRM", "أُرسل إلى CRM")} value={`${data.crm?.delivered ?? 0}`} sub={L(`${data.crm?.queued ?? 0} queued`, `${data.crm?.queued ?? 0} في الانتظار`)} />
            </div>
          </Section>
        </div>
      )}
    </aside>
  )
}

function RankingSection({ data, lang }: { data: LensData; lang: Lang }) {
  const ar = lang === "ar"
  const L = (en: string, a: string) => (ar ? a : en)
  const last = Object.values(data.last).sort((a, b) => b.ts.localeCompare(a.ts))[0]
  return (
    <Section
      icon={Activity}
      title={L("Why these items, in this order", "لماذا هذا المحتوى وبهذا الترتيب")}
      right={last && <span className="flex items-center gap-1 text-[11px] text-muted-foreground num"><Timer className="size-3" />{last.rank_ms.toFixed(0)} ms</span>}
    >
      {!last ? (
        <p className="text-xs text-muted-foreground">{L("Open a page on the portal to see the breakdown.", "افتح صفحة في البوابة لرؤية التفاصيل.")}</p>
      ) : (
        <>
          {last.fallback && <p className="mb-2 text-[11px] text-amber-700">{L("Editor-curated list served (fallback)", "عُرضت قائمة المحررين (وضع احتياطي)")}</p>}
          <ol className="space-y-2.5">
            {last.items.map((it, i) => {
              const max = Math.max(...last.items.map((x) => x.score), 0.0001)
              return (
                <li key={it.item_id} className="text-xs">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="num w-4 text-muted-foreground">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate font-medium">{it.title[lang] ?? it.title.en}</span>
                    <LevelBadge level={it.level} className="!text-[9.5px]" />
                  </div>
                  <div className="ps-6">
                    {Object.keys(it.components).length ? <StackBar components={it.components} max={max} height={6} /> : <div className="h-1.5 rounded-full bg-[#eef0f6]" />}
                  </div>
                  <div className="mt-0.5 truncate ps-6 text-[10.5px] text-muted-foreground">{it.reason}</div>
                </li>
              )
            })}
          </ol>
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5">
            {COMPONENT_ORDER.map((k) => (
              <span key={k} className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
                <span className="size-2 rounded-sm" style={{ background: COMPONENT_COLOR[k] }} />
                {ar ? COMPONENT_AR[k] : COMPONENT_SHORT[k]}
              </span>
            ))}
          </div>
        </>
      )}
    </Section>
  )
}

function Chip({ ok, children }: { ok?: boolean; children: React.ReactNode }) {
  return (
    <span className={cn("rounded-full px-2 py-0.5 font-medium ring-1", ok ? "bg-white text-foreground/75 ring-black/10" : "bg-rose-50 text-rose-700 ring-rose-200")}>
      {children}
    </span>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl bg-[#f5f6fa] p-3">
      <div className="text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold num">{value}</div>
      <div className="text-muted-foreground">{sub}</div>
    </div>
  )
}
