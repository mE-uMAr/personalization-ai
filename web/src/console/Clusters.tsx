import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { FileText, PlayCircle, Sparkles } from "lucide-react"
import { api, type ClustersData } from "@/lib/api"
import { useConfig } from "@/lib/hooks"
import { useSession } from "@/lib/session"
import { useAdmin } from "@/lib/admin-i18n"
import { cn } from "@/lib/utils"
import { PageHeader } from "./ConsoleLayout"

// Cluster identity is carried by numbered labels, the card list and hover highlighting,
// not by colour alone.
const CLUSTER_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"]
const W = 760
const H = 560
const PAD = 28

export default function Clusters() {
  const { hcpId } = useSession()
  const cfg = useConfig()
  const { L, lang, ar } = useAdmin()
  const q = useQuery({ queryKey: ["clusters", lang], queryFn: () => api.clusters(lang), refetchInterval: 3000 })
  const [focus, setFocus] = useState<number | null>(null)
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

  const colorOf = (cid: number | null) => (cid === null || cid < 0 ? "#c4c7d4" : CLUSTER_COLORS[cid % CLUSTER_COLORS.length])
  const live = d?.points.filter((p) => p.live || p.hcp_id.startsWith("hcp_demo_")) ?? []

  return (
    <div>
      <PageHeader
        title={L("Peer segments", "شرائح الزملاء")}
        sub={L("HCPs who behave alike are grouped automatically: nobody defines the segments by hand. Each segment feeds the “Popular with peers” list. Groups under 20 HCPs are never used, to protect privacy.", "يُجمَّع الأطباء ذوو السلوك المتشابه تلقائياً دون تحديد يدوي للشرائح، وتغذي كل شريحة قائمة “شائع بين الزملاء”. لا تُستخدم أي مجموعة أقل من 20 طبيباً حمايةً للخصوصية.")}
        right={d && (
          <div className="flex gap-2 text-xs">
            <Stat k={L("HCPs in the sample", "الأطباء في العينة")} v={d.stats.hcps} />
            <Stat k={L("Segments found", "الشرائح")} v={d.clusters.length} />
            <Stat k={L("Not yet matched", "غير مطابق بعد")} v={`${Math.round((d.stats.noise / d.stats.hcps) * 100)}%`} />
          </div>
        )}
      />
      {d && scale && (
        <div className="grid gap-6 px-8 pb-12 pt-6 2xl:grid-cols-[minmax(0,820px)_1fr]">
          <div className="rounded-2xl border border-black/[0.06] bg-white p-5 shadow-[0_1px_2px_rgba(13,19,48,0.04)]">
            <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>{L("Map of HCP behaviour · each dot is one HCP · closer dots behave more alike", "خريطة سلوك الأطباء · كل نقطة طبيب · النقاط الأقرب أكثر تشابهاً")}</span>
            </div>
            <svg direction="ltr" viewBox={`0 0 ${W} ${H}`} className="w-full rounded-xl bg-[#fafbfd]" onMouseLeave={() => setFocus(null)}>
              {d.points.filter((p) => p.synthetic && !p.hcp_id.startsWith("hcp_demo_")).map((p) => {
                const dim = focus !== null && p.cluster_id !== focus
                return (
                  <circle
                    key={p.hcp_id}
                    cx={scale.x(p.x)}
                    cy={scale.y(p.y)}
                    r={p.cluster_id === -1 ? 2.6 : 3.6}
                    fill={colorOf(p.cluster_id)}
                    opacity={dim ? 0.12 : p.cluster_id === -1 ? 0.6 : 0.85}
                    stroke="#fbfbfd"
                    strokeWidth={0.8}
                  />
                )
              })}
              {d.clusters.map((c) => {
                const pts = d.points.filter((p) => p.synthetic && p.cluster_id === c.cluster_id)
                const cx = pts.reduce((s, p) => s + scale.x(p.x), 0) / (pts.length || 1)
                const cy = pts.reduce((s, p) => s + scale.y(p.y), 0) / (pts.length || 1)
                return (
                  <g key={c.cluster_id} onMouseEnter={() => setFocus(c.cluster_id)} className="cursor-pointer">
                    <circle cx={cx} cy={cy} r={13} fill="white" stroke={colorOf(c.cluster_id)} strokeWidth={2.5} opacity={focus !== null && focus !== c.cluster_id ? 0.3 : 1} />
                    <text x={cx} y={cy + 4.5} textAnchor="middle" fontSize="12" fontWeight="700" fill="#0d1330" opacity={focus !== null && focus !== c.cluster_id ? 0.3 : 1}>
                      {c.cluster_id + 1}
                    </text>
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
                    <circle cx={x} cy={y} r={me ? 7 : 5.5} fill={me ? "#fa5c00" : "#0d1330"} stroke="white" strokeWidth={2} />
                    <rect x={lx} y={y - 11} rx={4} width={lw} height={20} fill={me ? "#fa5c00" : "#0d1330"} opacity={0.92} />
                    <text x={lx + 6} y={y + 3} fontSize="11" fontWeight="600" fill="white">{label}</text>
                  </g>
                )
              })}
            </svg>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11.5px] text-muted-foreground">
              {d.clusters.map((c) => (
                <span key={c.cluster_id} className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full" style={{ background: colorOf(c.cluster_id) }} />
                  {c.cluster_id + 1}
                </span>
              ))}
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-[#c4c7d4]" />{L("Not yet matched (uses nearest segment by specialty and country)", "غير مطابق بعد (يُستخدم أقرب شريحة حسب التخصص والدولة)")}</span>
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-ember-500" />{L("Current HCP", "الطبيب الحالي")}</span>
            </div>
          </div>

          <div className="grid content-start gap-3 md:grid-cols-2 2xl:grid-cols-1">
            {d.clusters.map((c) => (
              <ClusterCard key={c.cluster_id} c={c} color={colorOf(c.cluster_id)} active={focus === c.cluster_id} onHover={setFocus} specLabel={(k) => cfg?.specialties[k]?.[lang] ?? k} ar={ar} hasMe={live.some((p) => p.hcp_id === hcpId && p.cluster_id === c.cluster_id)} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ClusterCard({ c, color, active, onHover, specLabel, hasMe, ar }: { c: ClustersData["clusters"][number]; color: string; active: boolean; onHover: (v: number | null) => void; specLabel: (k: string) => string; hasMe: boolean; ar: boolean }) {
  const L = (en: string, a: string) => (ar ? a : en)
  const specs = Object.entries(c.specialties).slice(0, 2)
  const total = Object.values(c.specialties).reduce((a, b) => a + b, 0)
  return (
    <div
      onMouseEnter={() => onHover(c.cluster_id)}
      onMouseLeave={() => onHover(null)}
      className={cn("rounded-2xl border border-black/[0.06] bg-white p-4 shadow-[0_1px_2px_rgba(13,19,48,0.04)] transition", active && "shadow-md ring-2", hasMe && "ring-2 ring-ember-500")}
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
