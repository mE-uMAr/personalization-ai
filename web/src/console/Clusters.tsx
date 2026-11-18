import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { FileText, PlayCircle, Sparkles } from "lucide-react"
import { api, type ClustersData } from "@/lib/api"
import { useConfig } from "@/lib/hooks"
import { useSession } from "@/lib/session"
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
  const q = useQuery({ queryKey: ["clusters"], queryFn: () => api.clusters("en"), refetchInterval: 3000 })
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
        title="HCP clusters"
        sub="Formed automatically by HDBSCAN on behaviour vectors — the engine finds the number of clusters itself. Groups under 20 HCPs are never formed."
        right={d && (
          <div className="flex gap-2 text-xs">
            <Stat k="Sample HCPs" v={d.stats.hcps} />
            <Stat k="Clusters" v={d.clusters.length} />
            <Stat k="Not assigned (noise)" v={`${Math.round((d.stats.noise / d.stats.hcps) * 100)}%`} />
            <Stat k="Min size" v={d.stats.min_cluster_size} />
          </div>
        )}
      />
      {d && scale && (
        <div className="grid gap-6 p-8 2xl:grid-cols-[minmax(0,800px)_1fr]">
          <div className="rounded-xl border bg-white p-4">
            <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>2D map of behaviour vectors (t-SNE) · each dot is one HCP</span>
              <span className="font-mono">{d.stats.implementation}</span>
            </div>
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-lg bg-[#fbfbfd]" onMouseLeave={() => setFocus(null)}>
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
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-[#c4c7d4]" />Noise (uses nearest cluster by specialty + country)</span>
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-ember-500" />Current HCP</span>
            </div>
          </div>

          <div className="grid content-start gap-3 md:grid-cols-2 2xl:grid-cols-1">
            {d.clusters.map((c) => (
              <ClusterCard key={c.cluster_id} c={c} color={colorOf(c.cluster_id)} active={focus === c.cluster_id} onHover={setFocus} specLabel={(k) => cfg?.specialties[k]?.en ?? k} hasMe={live.some((p) => p.hcp_id === hcpId && p.cluster_id === c.cluster_id)} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ClusterCard({ c, color, active, onHover, specLabel, hasMe }: { c: ClustersData["clusters"][number]; color: string; active: boolean; onHover: (v: number | null) => void; specLabel: (k: string) => string; hasMe: boolean }) {
  const specs = Object.entries(c.specialties).slice(0, 2)
  const total = Object.values(c.specialties).reduce((a, b) => a + b, 0)
  return (
    <div
      onMouseEnter={() => onHover(c.cluster_id)}
      onMouseLeave={() => onHover(null)}
      className={cn("rounded-xl border bg-white p-4 transition", active && "shadow-md ring-2", hasMe && "ring-2 ring-ember-500")}
      style={active ? { ["--tw-ring-color" as string]: color } : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white" style={{ background: color }}>{c.cluster_id + 1}</span>
          <div>
            <div className="font-semibold leading-snug">{c.label_en}</div>
            <div className="mt-0.5 text-xs text-muted-foreground" dir="rtl" lang="ar">{c.label_ar}</div>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold num">{c.size}</span>
      </div>
      {hasMe && <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-ember-50 px-2 py-0.5 text-[11px] font-medium text-ember-600"><Sparkles className="size-3" />Current HCP is here</div>}
      <ul className="mt-3 space-y-1 text-[12.5px] text-foreground/80">
        {c.behaviours.map((b) => <li key={b} className="flex gap-2"><span className="mt-1.5 size-1 shrink-0 rounded-full bg-foreground/40" />{b}</li>)}
      </ul>
      <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
        {specs.map(([k, n]) => <span key={k} className="rounded bg-muted px-1.5 py-0.5">{specLabel(k)} {Math.round((n / total) * 100)}%</span>)}
        {c.top_tas.slice(0, 2).map((t) => <span key={t.ta} className="rounded px-1.5 py-0.5 text-white" style={{ background: t.color }}>{t.name} {Math.round(t.share * 100)}%</span>)}
      </div>
      <div className="mt-3 border-t pt-2.5">
        <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Top content (→ “Popular with peers”)</div>
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
    <div className="rounded-lg border bg-white px-3 py-1.5">
      <div className="text-[10.5px] text-muted-foreground">{k}</div>
      <div className="text-sm font-semibold num">{v}</div>
    </div>
  )
}
