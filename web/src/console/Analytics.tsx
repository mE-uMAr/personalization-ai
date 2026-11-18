import { useQuery } from "@tanstack/react-query"
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Activity } from "lucide-react"
import { LevelBadge } from "@/components/brand"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { api } from "@/lib/api"
import { LoadError } from "@/components/load-error"
import { useConfig } from "@/lib/hooks"
import { PageHeader, Panel } from "./ConsoleLayout"

const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`
const SLOT_LABEL: Record<string, string> = {
  home_recommended: "Home · recommended", ta_page: "Therapy-area page", peers: "Popular with peers", start_here: "Start here",
  next: "End of item · next", continue_watching: "Continue watching",
}
const LEVEL_FILL: Record<string, string> = { L1: "#0b3bc8", L2: "#6d3be8", L3: "#009e8f", editor: "#8a6a1a", exploration: "#db4f00" }

export default function Analytics() {
  const q = useQuery({ queryKey: ["analytics"], queryFn: api.analytics, refetchInterval: 5000 })
  const cfg = useConfig()
  const d = q.data
  const taName = (id: string) => cfg?.therapy_areas.find((t) => t.id === id)?.en ?? id
  const taColor = (id: string) => cfg?.therapy_areas.find((t) => t.id === id)?.color ?? "#888"

  return (
    <div>
      <PageHeader
        title="Analytics"
        sub="Built from recorded events and impressions only — last 30 days. Click = item opened from a recommendation in the same session."
        right={d && (
          <div className="flex items-center gap-2 rounded-lg border bg-ember-50 px-3 py-2 text-xs">
            <Activity className="size-3.5 text-ember-600" />
            <span>Live run <b className="font-mono">{d.live_run.run}</b>: <b className="num">{d.live_run.events}</b> events · <b className="num">{d.live_run.impressions}</b> impressions</span>
          </div>
        )}
      />
      {q.isError && <div className="p-8"><LoadError onRetry={() => q.refetch()} /></div>}
      {d && (
        <div className="space-y-6 p-8">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
            <Kpi label="Click-through rate" value={pct(d.kpis.ctr)} sub={`${d.kpis.clicks.toLocaleString()} / ${d.kpis.impressions.toLocaleString()}`} />
            <Kpi label="Completion after click" value={pct(d.kpis.completion_after_click)} sub="read ≥60% / watched 100%" />
            <Kpi label="Return visits" value={pct(d.kpis.return_visits)} sub="HCPs active on ≥2 days" />
            <Kpi label="Session coverage" value={pct(d.kpis.session_coverage)} sub="sessions with a rec consumed" />
            <Kpi label="Catalogue coverage" value={pct(d.kpis.catalogue_coverage)} sub="eligible items recommended" />
            <Kpi label="Active HCPs" value={d.kpis.active_hcps.toLocaleString()} sub={`${d.kpis.sessions.toLocaleString()} sessions`} />
            <Kpi label="Events captured" value={d.kpis.events.toLocaleString()} sub="one schema for all" />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Panel title="Daily engagement" sub="Events per day">
              <div className="h-56">
                <ResponsiveContainer>
                  <AreaChart data={d.daily} margin={{ left: -12, right: 8, top: 6 }}>
                    <defs>
                      <linearGradient id="ev" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#1534c4" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#1534c4" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="#eceef5" />
                    <XAxis dataKey="day" tickFormatter={(v) => v.slice(5)} tick={{ fontSize: 11, fill: "#5b6280" }} tickLine={false} axisLine={false} minTickGap={24} />
                    <YAxis tick={{ fontSize: 11, fill: "#5b6280" }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Area type="monotone" dataKey="events" name="Events" stroke="#1534c4" strokeWidth={2} fill="url(#ev)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Panel>
            <Panel title="Click-through by day" sub="Recommendation clicks ÷ impressions">
              <div className="h-56">
                <ResponsiveContainer>
                  <AreaChart data={d.daily} margin={{ left: -6, right: 8, top: 6 }}>
                    <CartesianGrid vertical={false} stroke="#eceef5" />
                    <XAxis dataKey="day" tickFormatter={(v) => v.slice(5)} tick={{ fontSize: 11, fill: "#5b6280" }} tickLine={false} axisLine={false} minTickGap={24} />
                    <YAxis tickFormatter={(v) => `${Math.round(v * 100)}%`} tick={{ fontSize: 11, fill: "#5b6280" }} tickLine={false} axisLine={false} />
                    <Tooltip formatter={(v) => pct(Number(v))} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Area type="monotone" dataKey="ctr" name="CTR" stroke="#fa5c00" strokeWidth={2} fill="#fa5c00" fillOpacity={0.08} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
            <Panel title="Performance by personalisation level" sub="CTR per level (L1 therapy area, L2 individual, L3 peers, editor, exploration)">
              <div className="h-56">
                <ResponsiveContainer>
                  <BarChart data={d.by_level} layout="vertical" margin={{ left: 8, right: 24 }}>
                    <CartesianGrid horizontal={false} stroke="#eceef5" />
                    <XAxis type="number" tickFormatter={(v) => `${Math.round(v * 100)}%`} tick={{ fontSize: 11, fill: "#5b6280" }} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="level" tick={{ fontSize: 12, fill: "#0d1330" }} tickLine={false} axisLine={false} width={80} />
                    <Tooltip formatter={(v) => pct(Number(v))} contentStyle={{ fontSize: 12, borderRadius: 8 }} cursor={{ fill: "#f2f3f8" }} />
                    <Bar dataKey="ctr" name="CTR" radius={[0, 4, 4, 0]} barSize={18}
                      shape={(p: { x?: number; y?: number; width?: number; height?: number; payload?: { level: string } }) => (
                        <rect x={p.x} y={p.y} width={p.width} height={p.height} rx={4} fill={LEVEL_FILL[p.payload?.level ?? ""] ?? "#888"} />
                      )}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
            <Panel title="By slot" sub="Impressions, clicks and completions per recommendation slot">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Slot</TableHead>
                    <TableHead className="text-end">Impressions</TableHead>
                    <TableHead className="text-end">CTR</TableHead>
                    <TableHead className="text-end">Completion after click</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.by_slot.map((r) => (
                    <TableRow key={r.slot}>
                      <TableCell className="font-medium">{SLOT_LABEL[r.slot] ?? r.slot}</TableCell>
                      <TableCell className="num text-end">{r.impressions.toLocaleString()}</TableCell>
                      <TableCell className="num text-end">{pct(r.ctr)}</TableCell>
                      <TableCell className="num text-end">{pct(r.completion_after_click)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Panel>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
            <Panel title="Top content" sub="Most opened items, last 30 days">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-end">Opens</TableHead>
                    <TableHead className="text-end">Completions</TableHead>
                    <TableHead className="text-end">HCPs</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.top_content.map((r) => (
                    <TableRow key={r.item_id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="size-2 shrink-0 rounded-full" style={{ background: taColor(r.therapy_area) }} />
                          <span className="max-w-[340px] truncate font-medium">{r.title?.en}</span>
                          <span className="text-[11px] text-muted-foreground">{r.type}</span>
                        </div>
                      </TableCell>
                      <TableCell className="num text-end">{r.opens}</TableCell>
                      <TableCell className="num text-end">{r.completions}</TableCell>
                      <TableCell className="num text-end">{r.hcps}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Panel>
            <div className="space-y-6">
              <Panel title="Engagement by therapy area" sub="Opens">
                <div className="space-y-2.5">
                  {d.by_ta.map((r) => {
                    const max = Math.max(...d.by_ta.map((x) => x.opens), 1)
                    return (
                      <div key={r.ta} className="grid grid-cols-[130px_1fr_56px] items-center gap-3 text-sm">
                        <span className="truncate">{taName(r.ta)}</span>
                        <div className="h-2.5 rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${(r.opens / max) * 100}%`, background: taColor(r.ta) }} /></div>
                        <span className="num text-end text-muted-foreground">{r.opens.toLocaleString()}</span>
                      </div>
                    )
                  })}
                </div>
              </Panel>
              <Panel title="Format" sub="Opens and completions">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Mini label="Article opens" v={d.formats.article_opens} sub={`${d.formats.article_reads.toLocaleString()} read`} />
                  <Mini label="Video opens" v={d.formats.video_opens} sub={`${d.formats.video_completions.toLocaleString()} watched to 100%`} />
                </div>
              </Panel>
            </div>
          </div>

          <Panel title="Coverage by country and language" sub="Fairness check — is any group under-served?">
            <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2 xl:grid-cols-4">
              {d.by_country.map((r) => (
                <div key={`${r.country}-${r.language}`} className="flex items-center justify-between border-b py-1.5 text-sm">
                  <span>{cfg?.countries[r.country]?.en ?? r.country} <span className="text-xs text-muted-foreground">· {r.language.toUpperCase()}</span></span>
                  <span className="num text-muted-foreground">{r.hcps} HCPs · {r.opens} opens</span>
                </div>
              ))}
            </div>
          </Panel>
          <p className="text-xs text-muted-foreground">Levels: <LevelBadge level="L1" /> <LevelBadge level="L2" /> <LevelBadge level="L3" /> <LevelBadge level="editor" /> <LevelBadge level="exploration" /> · Sample history is synthetic; live demo events are added on top in real time.</p>
        </div>
      )}
    </div>
  )
}

function Kpi({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1.5 text-2xl font-semibold tracking-tight num">{value}</div>
      <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{sub}</div>
    </div>
  )
}

function Mini({ label, v, sub }: { label: string; v: number; sub: string }) {
  return (
    <div className="rounded-lg bg-muted/60 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold num">{v.toLocaleString()}</div>
      <div className="text-[11px] text-muted-foreground">{sub}</div>
    </div>
  )
}
