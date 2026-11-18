// Engine lens: live view of what the engine knows and why it ranked what it ranked.
// Polls every 2 s. The room watches the engine learn instead of taking our word for it.
import { useEffect, useRef, useState } from "react"
import { Activity, ArrowRightLeft, Boxes, Gauge, Radio, ShieldCheck, Timer, Users, Workflow, X } from "lucide-react"
import { LevelBadge, TaDot } from "@/components/brand"
import type { LensData } from "@/lib/api"
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
  ta_affinity: "TA affinity",
  peer_pop: "Peer popularity",
  content: "Content match",
  related: "Similarity",
  freshness: "Freshness",
}

const EVENT_LABEL: Record<string, string> = {
  item_open: "Opened",
  article_scroll: "Scrolled",
  article_read: "Read",
  time_spent: "Time spent",
  video_start: "Started video",
  video_progress: "Watched",
  dismiss: "Not relevant",
  save: "Saved",
  search: "Searched",
}

function ago(ts: string) {
  const s = Math.max(0, (Date.now() - new Date(ts).getTime()) / 1000)
  if (s < 60) return `${Math.round(s)}s`
  if (s < 3600) return `${Math.round(s / 60)}m`
  if (s < 86400) return `${Math.round(s / 3600)}h`
  return `${Math.round(s / 86400)}d`
}

function evValue(e: LensData["events"][number]) {
  if (!e.value) return ""
  if (e.event_type === "video_progress") return `${e.value}%`
  if (e.event_type === "article_scroll") return `${e.value}%`
  if (e.event_type === "time_spent" || e.event_type === "article_read") return `${e.value}s`
  return e.value
}

export function Section({ icon: Icon, title, right, children, className }: { icon: React.ElementType; title: string; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("border-b border-white/[0.07] px-5 py-4", className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">
          <Icon className="size-3.5" />
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
    <div className="flex w-full gap-[2px] overflow-hidden rounded-full bg-white/[0.06]" style={{ height }}>
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

export function EngineLens({ hcpId, onClose, className }: { hcpId: string | null; onClose?: () => void; className?: string }) {
  const { data, isLoading } = useLens(hcpId)
  const cfg = useConfig()
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

  const taName = (id: string) => cfg?.therapy_areas.find((t) => t.id === id)?.en ?? id

  return (
    <aside className={cn("flex h-full flex-col overflow-hidden bg-[#0a1238] text-white", className)} dir="ltr" lang="en">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-[#0d1747] px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex size-2.5 rounded-full bg-emerald-400" />
          </span>
          <div>
            <div className="text-sm font-semibold tracking-tight">Engine lens</div>
            <div className="text-[11px] text-white/50 num">{data ? `${data.hcp.hcp_id} · ${data.model_version}` : "live · polling 2 s"}</div>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="rounded-md p-1.5 text-white/60 hover:bg-white/10 hover:text-white" aria-label="Close lens">
            <X className="size-4" />
          </button>
        )}
      </div>

      {!hcpId && <div className="p-6 text-sm text-white/60">Select or register an HCP to watch the engine.</div>}
      {hcpId && isLoading && <div className="p-6 text-sm text-white/60">Loading…</div>}
      {data && (
        <div className="scrollbar-thin flex-1 overflow-y-auto">
          {/* consent + state */}
          <div className="flex flex-wrap gap-1.5 border-b border-white/[0.07] px-5 py-3 text-[11px]">
            <Chip ok>{cfg?.specialties[data.hcp.specialty]?.en ?? data.hcp.specialty} · {data.hcp.country}</Chip>
            <Chip ok={data.hcp.verified}>{data.hcp.verified ? "Verified HCP" : "Not verified"}</Chip>
            <Chip ok={data.hcp.tracking_consent}>{data.hcp.tracking_consent ? "Tracking consent" : "No tracking"}</Chip>
            <Chip ok={data.hcp.crm_consent}>{data.hcp.crm_consent ? "CRM consent" : "No CRM consent"}</Chip>
            {(data.switches_state.engine_down || data.switches_state.paused) && (
              <span className="rounded-full bg-amber-400/15 px-2 py-0.5 font-medium text-amber-300 ring-1 ring-amber-400/30">
                {data.switches_state.engine_down ? "Engine down → editor lists" : "Personalisation paused"}
              </span>
            )}
          </div>

          {/* cold → warm */}
          <Section icon={Gauge} title="Cold start → personal" right={<span className="num text-xs text-white/70">{Math.round(data.alpha * 100)}% personal</span>}>
            <div className="flex gap-1">
              {Array.from({ length: cfg?.engine.cold_start_actions ?? 5 }).map((_, i) => (
                <div key={i} className={cn("h-2 flex-1 rounded-full transition-colors duration-500", i < data.actions ? "bg-ember-500" : "bg-white/10")} />
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[11px] text-white/50 num">
              <span>{data.actions} action{data.actions === 1 ? "" : "s"}</span>
              <span>α = min(actions / 5, 1) = {data.alpha.toFixed(2)}</span>
            </div>
          </Section>

          {/* L1 */}
          <Section icon={ArrowRightLeft} title="Level 1 · therapy areas" right={<span className="text-[11px] text-white/50">switch margin 15%</span>}>
            <div className={cn("mb-3 flex items-center justify-between rounded-lg bg-white/[0.05] px-3 py-2 transition", landingFlash && "pulse-ring bg-ember-500/20")}>
              <span className="text-[11px] uppercase tracking-wider text-white/50">Landing TA</span>
              <span className="flex items-center gap-2 text-sm font-semibold">
                <TaDot color={data.ta[0]?.color ?? "#fff"} />
                {taName(data.landing_ta)}
              </span>
            </div>
            <div className="space-y-2">
              {data.ta.map((t) => {
                const max = Math.max(...data.ta.map((x) => x.score), 1)
                return (
                  <div key={t.ta} className="grid grid-cols-[110px_1fr_44px] items-center gap-2 text-xs">
                    <span className="truncate text-white/80">{taName(t.ta)}</span>
                    <div className="h-2 rounded-full bg-white/[0.06]">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(t.score / max) * 100}%`, background: t.color }} />
                    </div>
                    <span className="num text-end text-white/70">{t.score.toFixed(1)}</span>
                  </div>
                )
              })}
            </div>
            {(() => {
              const order = data.ta.map((x) => x.ta)
              const [nextTa, gap] = Object.entries(data.switch_gap).sort((a, b) => a[1] - b[1] || order.indexOf(a[0]) - order.indexOf(b[0]))[0] ?? []
              return nextTa ? (
                <p className="mt-3 text-[11.5px] leading-relaxed text-white/55">
                  <span className="text-white/85">{taName(nextTa)}</span> needs <span className="num font-semibold text-ember-500">+{gap}</span> points to become the landing TA
                  <span className="text-white/40"> (read ≈ 4 · open 1 · video 1/2/3)</span>
                </p>
              ) : null
            })()}
            {data.switches.length > 0 && (
              <div className="mt-2 text-[11px] text-white/50">
                Last switch: {taName(data.switches[data.switches.length - 1].from)} → {taName(data.switches[data.switches.length - 1].to)} at action {data.switches[data.switches.length - 1].at_action}
              </div>
            )}
          </Section>

          {/* L3 */}
          <Section icon={Users} title="Level 3 · peer cluster">
            {data.cluster ? (
              <div className="rounded-lg bg-white/[0.05] p-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-semibold leading-snug">{data.cluster.label_en}</span>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-medium ring-1",
                      data.cluster.source === "assigned" ? "bg-emerald-400/15 text-emerald-300 ring-emerald-400/30" : data.cluster.source === "provisional" ? "bg-amber-400/15 text-amber-300 ring-amber-400/30" : "bg-white/10 text-white/70 ring-white/20",
                    )}
                  >
                    {data.cluster.source === "assigned" ? "Assigned by behaviour" : data.cluster.source === "provisional" ? "Provisional · specialty + country" : "Clustered"}
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-white/50 num">{data.cluster.size} similar HCPs · min size 20</div>
                {data.cluster.source === "provisional" && !data.hcp.synthetic && (
                  <div className="mt-1.5 text-[11px] text-white/50">Moves to the nearest real cluster at {data.cluster_assign_at} actions</div>
                )}
              </div>
            ) : (
              <p className="text-xs text-white/50">No cluster — behaviour is not stored without tracking consent.</p>
            )}
          </Section>

          {/* last ranking */}
          <RankingSection data={data} />

          {/* events */}
          <Section icon={Radio} title="Live events" right={<span className="text-[11px] text-white/50">capture &lt; 2 s</span>}>
            {data.events.length === 0 ? (
              <p className="text-xs text-white/50">No events yet.</p>
            ) : (
              <ol className="space-y-1">
                {data.events.slice(0, 10).map((e) => (
                  <li key={e.event_id} className={cn("grid grid-cols-[1fr_auto] gap-2 rounded-md px-2 py-1.5 text-xs transition-colors", flashIds.has(e.event_id) ? "bg-ember-500/25" : "bg-white/[0.03]")}>
                    <span className="min-w-0 truncate">
                      <span className="font-medium text-white">{EVENT_LABEL[e.event_type] ?? e.event_type}</span>
                      {evValue(e) && <span className="num text-ember-500"> {evValue(e)}</span>}
                      {e.title && <span className="text-white/55"> · {e.title}</span>}
                    </span>
                    <span className="num text-white/40">{ago(e.ts)}</span>
                  </li>
                ))}
              </ol>
            )}
          </Section>

          <Section icon={Workflow} title="Pipeline" className="border-b-0">
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <Stat icon={ShieldCheck} label="Eligible items" value={`${data.eligible}`} sub={`${Object.keys(data.removed).length} removed by rules`} />
              <Stat icon={Boxes} label="CRM (mock OCE)" value={`${data.crm?.delivered ?? 0}`} sub={`${data.crm?.queued ?? 0} queued`} />
            </div>
          </Section>
        </div>
      )}
    </aside>
  )
}

function RankingSection({ data }: { data: LensData }) {
  const last = Object.values(data.last).sort((a, b) => b.ts.localeCompare(a.ts))[0]
  return (
    <Section
      icon={Activity}
      title={`Last ranking${last ? ` · ${last.slot.replace("_", " ")}` : ""}`}
      right={last && <span className="flex items-center gap-1 text-[11px] text-white/70 num"><Timer className="size-3" />{last.rank_ms.toFixed(1)} ms</span>}
    >
      {!last ? (
        <p className="text-xs text-white/50">Open a page on the site to see the score breakdown.</p>
      ) : (
        <>
          {last.fallback && <p className="mb-2 text-[11px] text-amber-300">Fallback: {last.fallback.replace("_", " ")} — editor-curated list served</p>}
          <ol className="space-y-2.5">
            {last.items.map((it, i) => {
              const max = Math.max(...last.items.map((x) => x.score), 0.0001)
              return (
                <li key={it.item_id} className="text-xs">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="num w-4 text-white/40">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-white/90">{it.title.en}</span>
                    <LevelBadge level={it.level} className="!text-[9.5px]" />
                  </div>
                  <div className="flex items-center gap-2 ps-6">
                    <div className="flex-1">
                      {Object.keys(it.components).length ? <StackBar components={it.components} max={max} height={6} /> : <div className="h-1.5 rounded-full bg-white/[0.06]" />}
                    </div>
                    <span className="num w-10 text-end text-white/55">{it.score.toFixed(2)}</span>
                  </div>
                  <div className="mt-0.5 truncate ps-6 text-[10.5px] text-white/45">{it.reason}</div>
                </li>
              )
            })}
          </ol>
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5">
            {COMPONENT_ORDER.map((k) => (
              <span key={k} className="flex items-center gap-1.5 text-[10.5px] text-white/60">
                <span className="size-2 rounded-sm" style={{ background: COMPONENT_COLOR[k] }} />
                {COMPONENT_SHORT[k]}
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
    <span className={cn("rounded-full px-2 py-0.5 font-medium ring-1", ok ? "bg-white/[0.06] text-white/80 ring-white/15" : "bg-rose-400/10 text-rose-300 ring-rose-400/25")}>
      {children}
    </span>
  )
}

function Stat({ icon: Icon, label, value, sub }: { icon: React.ElementType; label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg bg-white/[0.05] p-2.5">
      <div className="flex items-center gap-1.5 text-white/50"><Icon className="size-3" />{label}</div>
      <div className="mt-1 text-lg font-semibold num">{value}</div>
      <div className="text-white/45">{sub}</div>
    </div>
  )
}
