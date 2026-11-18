import { Fragment, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ChevronRight } from "lucide-react"
import { LevelBadge } from "@/components/brand"
import { COMPONENT_COLOR, COMPONENT_ORDER, COMPONENT_SHORT, StackBarLight } from "./stack"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { api } from "@/lib/api"
import { useSession } from "@/lib/session"
import { cn } from "@/lib/utils"
import { HcpPicker } from "./HcpPicker"
import { PageHeader, Panel } from "./ConsoleLayout"

export default function Inspector() {
  const { hcpId } = useSession()
  const q = useQuery({ queryKey: ["impressions", hcpId], queryFn: () => api.impressions(hcpId!, "en"), enabled: !!hcpId, refetchInterval: 4000 })
  const [open, setOpen] = useState<string | null>(null)
  const rows = q.data?.impressions ?? []
  const max = Math.max(...rows.map((r) => r.score), 0.0001)
  return (
    <div>
      <PageHeader title="HCP inspector" sub="“Why did this HCP see this item?” — answered from the impression log: slot, rank, signals, model version, time." right={<HcpPicker />} />
      <div className="p-8">
        <Panel title={`${rows.length} most recent impressions`} sub="Every recommendation shown is stored for regulatory inspection." right={
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {COMPONENT_ORDER.map((k) => <span key={k} className="flex items-center gap-1 text-[11px] text-muted-foreground"><span className="size-2 rounded-sm" style={{ background: COMPONENT_COLOR[k] }} />{COMPONENT_SHORT[k]}</span>)}
          </div>
        }>
          {!hcpId ? <p className="text-sm text-muted-foreground">Select an HCP.</p> : (
            <div className="-m-5">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="ps-5">Time</TableHead>
                    <TableHead>Slot · rank</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead className="w-[220px]">Signals</TableHead>
                    <TableHead>Reason shown</TableHead>
                    <TableHead className="pe-5">Model</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <Fragment key={r.impression_id}>
                      <TableRow className="cursor-pointer" onClick={() => setOpen(open === r.impression_id ? null : r.impression_id)}>
                        <TableCell className="ps-5 num text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><ChevronRight className={cn("size-3.5 transition", open === r.impression_id && "rotate-90")} />{new Date(r.ts).toLocaleTimeString()}</span>
                        </TableCell>
                        <TableCell className="text-xs">{r.slot} · #{r.rank + 1}</TableCell>
                        <TableCell className="max-w-[260px] truncate font-medium">{r.title}</TableCell>
                        <TableCell><LevelBadge level={r.level} /></TableCell>
                        <TableCell>{r.signals.components && Object.keys(r.signals.components).length ? <StackBarLight components={r.signals.components} max={max} /> : <span className="text-xs text-muted-foreground">template only</span>}</TableCell>
                        <TableCell className="max-w-[260px] truncate text-xs">{r.reason}</TableCell>
                        <TableCell className="pe-5 font-mono text-[11px] text-muted-foreground">{r.model_version}</TableCell>
                      </TableRow>
                      {open === r.impression_id && (
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableCell colSpan={7} className="px-5 py-3">
                            <div className="grid gap-4 text-xs md:grid-cols-3">
                              <div>
                                <div className="mb-1 font-medium">Score {r.score.toFixed(4)}</div>
                                {Object.entries(r.signals.components ?? {}).map(([k, v]) => (
                                  <div key={k} className="flex justify-between gap-4 num"><span className="text-muted-foreground">{COMPONENT_SHORT[k] ?? k}</span><span>{v.toFixed(4)}</span></div>
                                ))}
                              </div>
                              <div className="space-y-0.5">
                                <div><span className="text-muted-foreground">α (personal share):</span> <span className="num">{r.signals.alpha}</span></div>
                                <div><span className="text-muted-foreground">Landing TA:</span> {r.signals.landing_ta}</div>
                                <div><span className="text-muted-foreground">Cluster:</span> {r.signals.cluster_id ?? "—"}</div>
                                <div><span className="text-muted-foreground">Fallback:</span> {r.signals.fallback ?? "none"}</div>
                              </div>
                              <div className="space-y-0.5 font-mono text-[10.5px] text-muted-foreground">
                                <div>impression {r.impression_id}</div>
                                <div>request {r.request_id}</div>
                                <div>template {r.reason_template}</div>
                                <div>variant {r.experiment_variant ?? "—"}</div>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Panel>
      </div>
    </div>
  )
}
