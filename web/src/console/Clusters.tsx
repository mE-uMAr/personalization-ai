import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { FileText, PlayCircle, Sparkles } from "lucide-react"
import { api, type ClustersData } from "@/lib/api"
import { useConfig } from "@/lib/hooks"
import { useSession } from "@/lib/session"
import { useAdmin } from "@/lib/admin-i18n"
import { cn } from "@/lib/utils"
import { PageHeader } from "./ConsoleLayout"

// Cluster identity is carried by numbered labels, names on the map, the chips and the profile,
// not by colour alone.
const CLUSTER_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"]
const W = 760
const H = 560
const PAD = 28

type Cluster = ClustersData["clusters"][number]

export default function Clusters() {
  const { hcpId } = useSession()
  const cfg = useConfig()
  const { L, lang, ar } = useAdmin()
  const q = useQuery({ queryKey: ["clusters", lang], queryFn: () => api.clusters(lang), refetchInterval: 3000 })
  const [hover, setHover] = useState<number | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const focus = hover ?? selected
  const d = q.data

  const scale = useMemo(() => {
    if (!d) return null
    const xs = d.points.map((p) => p.x)
    const ys = d.points.map((p) => p.y)
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
    return {
      x: (v: number) => PAD + ((v - x0) / (x1 - x0 || 1)) * (W - PAD * 2),
      y: (v: number) => PAD + ((v - y0) / (y1 - y0 || 1)) * (H - PAD * 2),
    }
  }, [d])

  const centres = useMemo(() => {
    const m = new Map<number, { x: number; y: number }>()
    if (!d || !scale) return m
    for (const c of d.clusters) {
      const pts = d.points.filter((p) => p.synthetic && p.cluster_id === c.cluster_id)
      m.set(c.cluster_id, {
        x: pts.reduce((s, p) => s + scale.x(p.x), 0) / (pts.length || 1),
        y: pts.reduce((s, p) => s + scale.y(p.y), 0) / (pts.length || 1),
      })
    }
    return m
  }, [d, scale])

  const colorOf = (cid: number | null) => (cid === null || cid < 0 ? "#c4c7d4" : CLUSTER_COLORS[cid % CLUSTER_COLORS.length])
  const live = d?.points.filter((p) => p.live || p.hcp_id.startsWith("hcp_demo_")) ?? []
  const toggle = (cid: number) => setSelected((s) => (s === cid ? null : cid))
  const specLabel = (k: string) => cfg?.specialties[k]?.[lang] ?? k
  const sel = d?.clusters.find((c) => c.cluster_id === selected) ?? null
  const myCluster = live.find((p) => p.hcp_id === hcpId)?.cluster_id ?? null
  const nameOf = (c: Cluster) => (ar ? c.label_ar : c.label_en) ?? ""

  return (
    <div>
      <PageHeader
        title={L("Peer segments", "شرائح الزملاء")}
        sub={L(
          "HCPs who behave alike are grouped automatically by machine learning: nobody defines the segments by hand. Select a segment to explore it.",
          "يُجمَّع الأطباء ذوو السلوك المتشابه تلقائياً بالتعلم الآلي دون تحديد يدوي للشرائح. اختر شريحة لاستكشافها.",
        )}
        right={d && (
          <div className="flex gap-2 text-xs">
            <Stat k={L("HCPs in the sample", "الأطباء في العينة")} v={d.stats.hcps} />
            <Stat k={L("Segments found", "الشرائح")} v={d.clusters.length} />
            <Stat k={L("Not yet matched", "غير مطابق بعد")} v={`${Math.round((d.stats.noise / d.stats.hcps) * 100)}%`} />
          </div>
        )}
      />
      {d && scale && (
        <div className="px-8 pb-12 pt-5">
          <div className="mb-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelected(null)}
              className={cn(
                "h-9 rounded-full border px-4 text-sm font-medium transition",
                selected === null ? "border-[#0d1330] bg-[#0d1330] text-white" : "border-black/10 bg-white text-foreground/70 hover:border-black/25",
              )}
            >
              {L("All segments", "كل الشرائح")}
            </button>
            {d.clusters.map((c) => {
              const on = selected === c.cluster_id
              const col = colorOf(c.cluster_id)
              return (
                <button
                  type="button"
                  key={c.cluster_id}
                  onClick={() => toggle(c.cluster_id)}
                  onMouseEnter={() => setHover(c.cluster_id)}
                  onMouseLeave={() => setHover(null)}
                  className={cn(
                    "inline-flex h-9 items-center gap-2 rounded-full border ps-1.5 pe-3.5 text-sm font-medium transition hover:shadow-sm",
                    on ? "text-white" : "border-black/10 bg-white text-foreground",
                  )}
                  style={on ? { background: col, borderColor: col } : undefined}
                >
                  <span
                    className="grid size-6 place-items-center rounded-full text-[11px] font-bold text-white"
                    style={{ background: on ? "rgba(255,255,255,.25)" : col }}
                  >
                    {c.cluster_id + 1}
                  </span>
                  <span className="whitespace-nowrap">{nameOf(c)}</span>
                  <span className={cn("num text-xs", on ? "text-white/80" : "text-muted-foreground")}>{c.size}</span>
                  {myCluster === c.cluster_id && <span className="size-2 rounded-full bg-ember-500" />}
                </button>
              )
            })}
          </div>

          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,1fr)]">
            <div className="rounded-2xl border border-black/[0.06] bg-white p-5 shadow-[0_1px_2px_rgba(13,19,48,0.04)]">
              <div className="mb-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>{L("Map of HCP behaviour · each dot is one HCP · closer dots behave more alike", "خريطة سلوك الأطباء · كل نقطة طبيب · النقاط الأقرب أكثر تشابهاً")}</span>
                <span className="shrink-0 font-medium text-brand-700">{L("Click a segment to explore", "انقر على شريحة لاستكشافها")}</span>
              </div>
              <svg
                direction="ltr"
                viewBox={`0 0 ${W} ${H}`}
                className="w-full rounded-xl bg-[#fafbfd]"
                onMouseLeave={() => setHover(null)}
                onClick={() => setSelected(null)}
              >
                {d.points.filter((p) => p.synthetic && !p.hcp_id.startsWith("hcp_demo_")).map((p) => {
                  const inFocus = focus !== null && p.cluster_id === focus
                  const dim = focus !== null && !inFocus
                  return (
                    <circle
                      key={p.hcp_id}
                      cx={scale.x(p.x)}
                      cy={scale.y(p.y)}
                      r={p.cluster_id === -1 ? 2.6 : inFocus ? 4.6 : 3.6}
                      fill={colorOf(p.cluster_id)}
                      opacity={dim ? 0.1 : p.cluster_id === -1 ? 0.6 : 0.85}
                      stroke="#fbfbfd"
                      strokeWidth={0.8}
                      style={{ transition: "opacity 250ms ease" }}
                    >
                      <title>{`${specLabel(p.specialty)} · ${cfg?.countries[p.country]?.[lang] ?? p.country}`}</title>
                    </circle>
                  )
                })}
                {d.clusters.map((c) => {
                  const pos = centres.get(c.cluster_id)
                  if (!pos) return null
                  const faded = focus !== null && focus !== c.cluster_id
                  const name = nameOf(c)
                  const short = name.length > 30 ? name.slice(0, 29) + "…" : name
                  const lw = short.length * 6.2 + 18
                  const flip = pos.x + 18 + lw > W - 4
                  const lx = flip ? pos.x - 18 - lw : pos.x + 18
                  const isSel = selected === c.cluster_id
                  return (
                    <g
                      key={c.cluster_id}
                      onMouseEnter={() => setHover(c.cluster_id)}
                      onClick={(e) => {
                        e.stopPropagation()
                        toggle(c.cluster_id)
                      }}
                      className="cursor-pointer"
                      opacity={faded ? 0.25 : 1}
                      style={{ transition: "opacity 250ms ease" }}
                    >
                      <circle cx={pos.x} cy={pos.y} r={isSel ? 16 : 13} fill="white" stroke={colorOf(c.cluster_id)} strokeWidth={isSel ? 3.5 : 2.5} />
                      <text x={pos.x} y={pos.y + 4.5} textAnchor="middle" fontSize="12" fontWeight="700" fill="#0d1330">{c.cluster_id + 1}</text>
                      <rect x={lx} y={pos.y - 11} rx={11} width={lw} height={22} fill="white" stroke={colorOf(c.cluster_id)} strokeOpacity={0.55} />
                      <text x={lx + 9} y={pos.y + 4} fontSize="11" fontWeight="600" fill="#0d1330">{short}</text>
                    </g>
                  )
                })}
                {live.map((p) => {
                  const x = scale.x(p.x)
                  const y = scale.y(p.y)
                  const me = p.hcp_id === hcpId
                  const label = p.name ?? p.hcp_id
                  const lw = Math.max(60, label.length * 6.4 + 12)
                  const flip = x + 10 + lw > W - 4
                  const lx = flip ? x - 10 - lw : x + 10
                  return (
                    <g key={p.hcp_id} style={{ transition: "transform 900ms ease" }}>
                      {me && <circle cx={x} cy={y} r={16} fill="#fa5c00" opacity={0.18}><animate attributeName="r" values="10;20;10" dur="2s" repeatCount="indefinite" /></circle>}
                      <circle cx={x} cy={y} r={me ? 7 : 5.5} fill={me ? "#fa5c00" : "#0d1330"} stroke="white" strokeWidth={2}>
                        <title>{label}</title>
                      </circle>
                      {me && <rect x={lx} y={y - 11} rx={4} width={lw} height={20} fill="#fa5c00" opacity={0.92} />}
                      {me && <text x={lx + 6} y={y + 3} fontSize="11" fontWeight="600" fill="white">{label}</text>}
                    </g>
                  )
                })}
              </svg>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11.5px] text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-[#c4c7d4]" />{L("Not yet matched (uses nearest segment by specialty and country)", "غير مطابق بعد (يُستخدم أقرب شريحة حسب التخصص والدولة)")}</span>
                <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-ember-500" />{L("Current HCP", "الطبيب الحالي")}</span>
              </div>
            </div>

            {sel ? (
              <SegmentProfile
                c={sel}
                color={colorOf(sel.cluster_id)}
                total={d.stats.hcps}
                specLabel={specLabel}
                ar={ar}
                hasMe={myCluster === sel.cluster_id}
                onClose={() => setSelected(null)}
              />
            ) : (
              <div className="grid content-start gap-3 md:grid-cols-2 xl:grid-cols-1">
                {d.clusters.map((c) => (
                  <ClusterCard
                    key={c.cluster_id}
                    c={c}
                    color={colorOf(c.cluster_id)}
                    active={hover === c.cluster_id}
                    onHover={setHover}
                    onSelect={() => toggle(c.cluster_id)}
                    specLabel={specLabel}
                    ar={ar}
                    hasMe={myCluster === c.cluster_id}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function SegmentProfile({ c, color, total, specLabel, ar, hasMe, onClose }: { c: Cluster; color: string; total: number; specLabel: (k: string) => string; ar: boolean; hasMe: boolean; onClose: () => void }) {
  const L = (en: string, a: string) => (ar ? a : en)
  const specTotal = Object.values(c.specialties).reduce((a, b) => a + b, 0) || 1
  const specs = Object.entries(c.specialties).sort((a, b) => b[1] - a[1]).slice(0, 3)
  return (
    <div className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-[0_8px_30px_rgba(13,19,48,0.08)]">
      <div className="px-6 pb-5 pt-5 text-white" style={{ background: color }}>
        <div className="flex items-start justify-between gap-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-white/85">{L("Segment", "الشريحة")} {c.cluster_id + 1}</div>
          <button type="button" onClick={onClose} className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-medium hover:bg-white/30">
            {L("All segments", "كل الشرائح")}
          </button>
        </div>
        <div className="mt-1 text-[22px] font-semibold leading-snug">{(ar ? c.label_ar : c.label_en) ?? ""}</div>
        <div className="mt-4 flex gap-8">
          <div>
            <div className="num text-[26px] font-semibold leading-none">{c.size}</div>
            <div className="mt-1 text-xs text-white/85">{L("HCPs", "طبيب")}</div>
          </div>
          <div>
            <div className="num text-[26px] font-semibold leading-none">{Math.round((c.size / (total || 1)) * 100)}%</div>
            <div className="mt-1 text-xs text-white/85">{L("of the sample", "من العينة")}</div>
          </div>
        </div>
        {hasMe && (
          <div className="mt-4 inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-0.5 text-[11px] font-semibold text-ember-600">
            <Sparkles className="size-3" />
            {L("Current HCP is in this segment", "الطبيب الحالي ضمن هذه الشريحة")}
          </div>
        )}
      </div>
      <div className="space-y-5 p-6">
        <div>
          <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{L("Therapy-area interest", "الاهتمام بالمجالات العلاجية")}</div>
          <div className="space-y-2.5">
            {c.top_tas.slice(0, 3).map((t) => (
              <div key={t.ta}>
                <div className="flex justify-between text-sm">
                  <span>{t.name}</span>
                  <span className="num text-muted-foreground">{Math.round(t.share * 100)}%</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-[#f0f1f6]">
                  <div className="h-full rounded-full" style={{ width: `${Math.round(t.share * 100)}%`, background: t.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{L("How they behave", "كيف يتصرفون")}</div>
          <ul className="space-y-1.5 text-[13px] text-foreground/85">
            {c.behaviours.map((b) => (
              <li key={b} className="flex gap-2"><span className="mt-1.5 size-1.5 shrink-0 rounded-full" style={{ background: color }} />{b}</li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-1.5 text-[11.5px]">
            {specs.map(([k, n]) => (
              <span key={k} className="rounded-full bg-muted px-2 py-0.5">{specLabel(k)} {Math.round((n / specTotal) * 100)}%</span>
            ))}
          </div>
        </div>
        <div className="border-t pt-4">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{L("Feeds “Popular with peers” with", "يغذي “شائع بين الزملاء” بـ")}</div>
          <ol className="space-y-2">
            {c.top_items.slice(0, 5).map((t, i) => (
              <li key={t.item_id} className="flex items-center gap-2.5 text-[13px]">
                <span className="num grid size-5 shrink-0 place-items-center rounded-full bg-muted text-[10.5px] font-semibold">{i + 1}</span>
                {t.type === "video" ? <PlayCircle className="size-4 shrink-0 text-muted-foreground" /> : <FileText className="size-4 shrink-0 text-muted-foreground" />}
                <span className="truncate">{t.title}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  )
}

function ClusterCard({ c, color, active, onHover, onSelect, specLabel, hasMe, ar }: { c: Cluster; color: string; active: boolean; onHover: (v: number | null) => void; onSelect: () => void; specLabel: (k: string) => string; hasMe: boolean; ar: boolean }) {
  const L = (en: string, a: string) => (ar ? a : en)
  const specs = Object.entries(c.specialties).slice(0, 2)
  const total = Object.values(c.specialties).reduce((a, b) => a + b, 0)
  return (
    <div
      onMouseEnter={() => onHover(c.cluster_id)}
      onMouseLeave={() => onHover(null)}
      onClick={onSelect}
      className={cn("cursor-pointer rounded-2xl border border-black/[0.06] bg-white p-4 shadow-[0_1px_2px_rgba(13,19,48,0.04)] transition hover:-translate-y-0.5 hover:shadow-md", active && "shadow-md ring-2", hasMe && "ring-2 ring-ember-500")}
      style={active ? { ["--tw-ring-color" as string]: color } : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white" style={{ background: color }}>{c.cluster_id + 1}</span>
          <div>
            <div className="font-semibold leading-snug">{ar ? c.label_ar : c.label_en}</div>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold num">{c.size}</span>
      </div>
      {hasMe && <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-ember-50 px-2 py-0.5 text-[11px] font-medium text-ember-600"><Sparkles className="size-3" />{L("Current HCP is in this segment", "الطبيب الحالي ضمن هذه الشريحة")}</div>}
      <ul className="mt-3 space-y-1 text-[12.5px] text-foreground/80">
        {c.behaviours.map((b) => <li key={b} className="flex gap-2"><span className="mt-1.5 size-1 shrink-0 rounded-full bg-foreground/40" />{b}</li>)}
      </ul>
      <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
        {specs.map(([k, n]) => <span key={k} className="rounded bg-muted px-1.5 py-0.5">{specLabel(k)} {Math.round((n / total) * 100)}%</span>)}
        {c.top_tas.slice(0, 2).map((t) => <span key={t.ta} className="rounded px-1.5 py-0.5 text-white" style={{ background: t.color }}>{t.name} {Math.round(t.share * 100)}%</span>)}
      </div>
      <div className="mt-3 border-t pt-2.5">
        <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{L("What this segment engages with", "ما تتفاعل معه هذه الشريحة")}</div>
        <ol className="space-y-1">
          {c.top_items.slice(0, 3).map((t) => (
            <li key={t.item_id} className="flex items-center gap-1.5 text-[12.5px]">
              {t.type === "video" ? <PlayCircle className="size-3.5 shrink-0 text-muted-foreground" /> : <FileText className="size-3.5 shrink-0 text-muted-foreground" />}
              <span className="truncate">{t.title}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

function Stat({ k, v }: { k: string; v: string | number }) {
  return (
    <div className="rounded-xl border border-black/[0.06] bg-white px-3.5 py-2">
      <div className="text-[10.5px] text-muted-foreground">{k}</div>
      <div className="text-sm font-semibold num">{v}</div>
    </div>
  )
}
