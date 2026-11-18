import { useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { Ban, CheckCircle2, Clock4, FileText, Pin, PlayCircle, RotateCcw, Workflow, XCircle } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { api } from "@/lib/api"
import { useConfig } from "@/lib/hooks"
import { queryClient } from "@/lib/track"
import { cn } from "@/lib/utils"
import { PageHeader, Panel } from "./ConsoleLayout"

const STATES = [
  ["verified", "Verified HCP"],
  ["registered", "Registered, not verified"],
  ["anonymous", "Anonymous visitor"],
] as const

export default function Content() {
  const cfg = useConfig()
  const [country, setCountry] = useState("MA")
  const [state, setState] = useState<string>("verified")
  const [filter, setFilter] = useState<"all" | "eligible" | "removed">("all")
  const q = useQuery({ queryKey: ["content", country, state], queryFn: () => api.content(country, state, "en") })
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["content"] })
    queryClient.invalidateQueries({ queryKey: ["recs"] })
  }
  const expire = useMutation({ mutationFn: api.expire, onSuccess: (_, id) => { refresh(); toast.success(`${id} expired`, { description: "Removed from every list on the next request — no caches to purge." }) } })
  const restore = useMutation({ mutationFn: api.restore, onSuccess: (_, id) => { refresh(); toast.success(`${id} restored`) } })
  const override = useMutation({ mutationFn: api.override, onSuccess: () => { refresh(); toast.success("Override saved — overrides beat the model") } })
  const clear = useMutation({ mutationFn: api.clearOverrides, onSuccess: refresh })

  const d = q.data
  const rows = (d?.items ?? []).filter((r) => filter === "all" || (filter === "eligible" ? r.eligible : !r.eligible))
  const ta = (id: string) => cfg?.therapy_areas.find((t) => t.id === id)
  const pinned = new Set(d?.overrides.filter((o) => o.action === "pin").map((o) => o.item_id))
  const blocked = new Set(d?.overrides.filter((o) => o.action === "block").map((o) => o.item_id))

  return (
    <div>
      <PageHeader
        title="Content & rules"
        sub="The eligibility filter runs first on every request. Pick a viewer to see exactly which rule removes each item."
        right={
          <div className="flex items-center gap-2">
            <select value={country} onChange={(e) => setCountry(e.target.value)} className="h-9 rounded-lg border bg-white px-3 text-sm">
              {cfg && Object.entries(cfg.countries).map(([k, v]) => <option key={k} value={k}>{v.en}</option>)}
            </select>
            <select value={state} onChange={(e) => setState(e.target.value)} className="h-9 rounded-lg border bg-white px-3 text-sm">
              {STATES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
        }
      />
      {d && (
        <div className="grid gap-6 p-8 xl:grid-cols-[1fr_300px]">
          <Panel
            title={`${d.eligible} of ${d.items.length} items eligible for this viewer`}
            right={
              <div className="inline-flex rounded-md border p-0.5 text-xs">
                {(["all", "eligible", "removed"] as const).map((f) => (
                  <button key={f} onClick={() => setFilter(f)} className={cn("rounded px-2.5 py-1 capitalize", filter === f ? "bg-brand-700 text-white" : "text-muted-foreground")}>{f}</button>
                ))}
              </div>
            }
          >
            <div className="-m-5">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="ps-5">Item</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Flags</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead>Eligibility</TableHead>
                    <TableHead className="pe-5 text-end">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.item_id} className={cn(!r.eligible && "bg-rose-50/40")}>
                      <TableCell className="ps-5">
                        <div className="flex items-center gap-2">
                          <span className="size-2 shrink-0 rounded-full" style={{ background: ta(r.therapy_area)?.color }} />
                          {r.type === "video" ? <PlayCircle className="size-3.5 text-muted-foreground" /> : <FileText className="size-3.5 text-muted-foreground" />}
                          <span className="max-w-[320px] truncate font-medium">{r.title}</span>
                        </div>
                        <div className="ms-[30px] flex items-center gap-2 font-mono text-[10.5px] text-muted-foreground">
                          {r.item_id} · {r.approval_code}
                          {r.pipeline && (
                            <Popover>
                              <PopoverTrigger asChild>
                                <button className="inline-flex items-center gap-1 rounded bg-brand-50 px-1.5 py-px font-sans text-[10.5px] font-medium text-brand-700 hover:bg-brand-100"><Workflow className="size-3" />Video pipeline</button>
                              </PopoverTrigger>
                              <PopoverContent align="start" className="w-80">
                                <ol className="space-y-2">
                                  {r.pipeline.map((p) => (
                                    <li key={p.step} className="grid grid-cols-[auto_1fr] gap-x-2.5 text-xs">
                                      <span className={cn("mt-1 size-2 rounded-full", p.mode === "real" ? "bg-emerald-500" : "bg-amber-400")} />
                                      <div>
                                        <span className="font-medium capitalize">{p.step}</span>
                                        <span className={cn("ms-1.5 rounded px-1 text-[10px] font-medium", p.mode === "real" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>{p.mode}</span>
                                        <div className="text-muted-foreground">{p.detail}</div>
                                      </div>
                                    </li>
                                  ))}
                                </ol>
                              </PopoverContent>
                            </Popover>
                          )}
                        </div>
                      </TableCell>
                      <TableCell><span className={cn("rounded px-1.5 py-0.5 text-[11px] font-medium", r.status === "published" ? "bg-emerald-50 text-emerald-700" : "bg-muted text-muted-foreground")}>{r.status}</span></TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 text-[10.5px]">
                          {r.promotional && <span className="rounded bg-ember-50 px-1.5 py-0.5 font-medium text-ember-600">Promo</span>}
                          <span className="rounded bg-muted px-1.5 py-0.5">{r.gated ? "Gated" : "Public"}</span>
                          {r.allowed_countries.length < 8 && <span className="rounded bg-muted px-1.5 py-0.5" title={r.allowed_countries.join(", ")}>{r.allowed_countries.length} countries</span>}
                          {pinned.has(r.item_id) && <span className="rounded bg-brand-100 px-1.5 py-0.5 font-medium text-brand-700">Pinned</span>}
                          {blocked.has(r.item_id) && <span className="rounded bg-rose-100 px-1.5 py-0.5 font-medium text-rose-700">Blocked</span>}
                        </div>
                      </TableCell>
                      <TableCell className="num text-xs text-muted-foreground">{r.expiry_date}</TableCell>
                      <TableCell>
                        {r.eligible ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700"><CheckCircle2 className="size-3.5" />Eligible</span>
                        ) : (
                          <span className="inline-flex items-start gap-1 text-xs text-rose-700" title={r.rule_text ?? ""}>
                            <XCircle className="mt-px size-3.5 shrink-0" />
                            <span><span className="font-mono">{r.rule}</span><span className="block max-w-[220px] text-[10.5px] text-rose-700/70">{r.rule_text}</span></span>
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="pe-5">
                        <div className="flex justify-end gap-1">
                          {r.status === "published" && r.rule !== "expired" ? (
                            <Button size="xs" variant="outline" onClick={() => expire.mutate(r.item_id)} title="Expire now"><Clock4 className="size-3" />Expire</Button>
                          ) : (
                            <Button size="xs" variant="ghost" onClick={() => restore.mutate(r.item_id)} title="Restore original dates"><RotateCcw className="size-3" /></Button>
                          )}
                          {pinned.has(r.item_id) || blocked.has(r.item_id) ? (
                            <Button size="xs" variant="ghost" onClick={() => clear.mutate(r.item_id)}>Clear</Button>
                          ) : (
                            <>
                              <Button size="xs" variant="ghost" title={`Pin for ${country}`} onClick={() => override.mutate({ action: "pin", country, therapy_area: r.therapy_area, item_id: r.item_id })}><Pin className="size-3" /></Button>
                              <Button size="xs" variant="ghost" title={`Block in ${country}`} onClick={() => override.mutate({ action: "block", country, item_id: r.item_id })}><Ban className="size-3" /></Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Panel>
          <div className="space-y-6">
            <Panel title="Market rule sheet" sub="Read from configuration, not code. Values are placeholders until the rule sheet is supplied.">
              <ul className="space-y-1.5 text-sm">
                {cfg && Object.entries(d.country_rules).map(([c, r]) => (
                  <li key={c} className="flex items-center justify-between">
                    <span>{cfg.countries[c]?.en}</span>
                    <span className={cn("rounded px-1.5 py-0.5 text-[11px] font-medium", r.promotional_allowed ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700")}>
                      {r.promotional_allowed ? "Promo allowed" : "No promo"}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
            <Panel title="Rules, in order">
              <ol className="list-decimal space-y-1.5 ps-4 text-xs text-muted-foreground">
                {cfg && Object.entries(cfg.rule_text).map(([k, v]) => <li key={k}><span className="font-mono text-foreground">{k}</span> — {v}</li>)}
              </ol>
              <p className="mt-3 text-[11px] text-muted-foreground">Rule-based code separate from ranking · 100% of filter tests pass · experiments can never relax it.</p>
            </Panel>
          </div>
        </div>
      )}
    </div>
  )
}
