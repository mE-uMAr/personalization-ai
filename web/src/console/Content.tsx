// Content & compliance: what each viewer may see in each market, and admin overrides.
import { useEffect, useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { Ban, CheckCircle2, Clock4, FileText, Pin, PlayCircle, RotateCcw, Workflow, XCircle } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { api } from "@/lib/api"
import { useAdmin } from "@/lib/admin-i18n"
import { useConfig } from "@/lib/hooks"
import { queryClient } from "@/lib/track"
import { cn } from "@/lib/utils"
import { AdminSelect, PageHeader, Panel, Segmented } from "./ConsoleLayout"

// Plain-language reason for each eligibility rule (the rule keys come from the API).
const RULE: Record<string, [string, string]> = {
  not_published: ["Not published", "غير منشور"],
  not_yet_live: ["Not live yet", "لم يُنشر بعد"],
  expired: ["Approval expired", "انتهت صلاحية الاعتماد"],
  country_blocked: ["Not approved for this market", "غير معتمد لهذا السوق"],
  promo_not_verified: ["Promotional: verified HCPs only", "ترويجي: للأطباء الموثقين فقط"],
  promo_country: ["Promotional content not allowed in this market", "المحتوى الترويجي غير مسموح في هذا السوق"],
  gated_anonymous: ["Registered HCPs only", "للأطباء المسجلين فقط"],
  admin_block: ["Blocked by an admin", "محظور من المسؤول"],
}

export default function Content() {
  const { L, lang, ar } = useAdmin()
  const cfg = useConfig()
  const [country, setCountry] = useState("SA")
  const [state, setState] = useState<string>("verified")
  const [filter, setFilter] = useState<"all" | "eligible" | "removed">("all")
  const q = useQuery({ queryKey: ["content", country, state, lang], queryFn: () => api.content(country, state, lang) })
  const market = cfg?.countries[country]?.[lang] ?? country
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["content"] })
    queryClient.invalidateQueries({ queryKey: ["recs"] })
  }
  const expire = useMutation({ mutationFn: api.expire, onSuccess: () => { refresh(); toast.success(L("Content expired", "انتهت صلاحية المحتوى"), { description: L("Removed from every recommendation list on the next page view; the CRM list updates in the next sync.", "أُزيل من كل قوائم التوصيات في الصفحة التالية، وتُحدَّث قائمة نظام إدارة العملاء في المزامنة التالية.") }) } })
  const restore = useMutation({ mutationFn: api.restore, onSuccess: () => { refresh(); toast.success(L("Content restored", "تمت استعادة المحتوى")) } })
  const override = useMutation({ mutationFn: api.override, onSuccess: () => { refresh(); toast.success(L("Override saved", "تم حفظ التدخل"), { description: L("Overrides always take priority over the engine.", "للتدخل أولوية دائماً على المحرك.") }) } })
  const clear = useMutation({ mutationFn: api.clearOverrides, onSuccess: refresh })

  const d = q.data
  const rows = (d?.items ?? []).filter((r) => filter === "all" || (filter === "eligible" ? r.eligible : !r.eligible))
  const ta = (id: string) => cfg?.therapy_areas.find((t) => t.id === id)
  const pinned = new Set(d?.overrides.filter((o) => o.action === "pin").map((o) => o.item_id))
  const blocked = new Set(d?.overrides.filter((o) => o.action === "block").map((o) => o.item_id))
  const ruleText = (r: string | null, fallback: string | null) => (r && RULE[r] ? RULE[r][ar ? 1 : 0] : fallback ?? r ?? "")

  return (
    <div className="pb-12">
      <PageHeader
        title={L("Content & compliance", "المحتوى والامتثال")}
        sub={L(
          "Market rules are applied before any ranking. Choose a market and an access level to see exactly what is shown and why anything is hidden.",
          "تُطبَّق قواعد السوق قبل أي ترتيب. اختر سوقاً ومستوى وصول لترى بالضبط ما يُعرض ولماذا يُخفى أي محتوى.",
        )}
        right={
          <div className="flex flex-wrap items-center gap-2">
            <AdminSelect label={L("Market", "السوق")} value={country} onChange={setCountry}>
              {cfg && Object.entries(cfg.countries).map(([k, v]) => <option key={k} value={k}>{v[lang]}</option>)}
            </AdminSelect>
            <AdminSelect label={L("Access level", "مستوى الوصول")} value={state} onChange={setState}>
              <option value="verified">{L("Verified HCP", "طبيب موثّق")}</option>
              <option value="registered">{L("Registered, not verified", "مسجّل غير موثّق")}</option>
              <option value="anonymous">{L("Anonymous visitor", "زائر مجهول")}</option>
            </AdminSelect>
          </div>
        }
      />
      {d && (
        <div className="grid gap-6 px-8 pt-6 2xl:grid-cols-[minmax(0,1fr)_320px] [&>*]:min-w-0">
          <Panel
            flush
            title={L(`${d.eligible} of ${d.items.length} items can be shown in ${market}`, `${d.eligible} من ${d.items.length} محتوى يمكن عرضه في ${market}`)}
            right={
              <Segmented value={filter} onChange={setFilter} options={[["all", L("All", "الكل")], ["eligible", L("Shown", "معروض")], ["removed", L("Hidden", "مخفي")]]} />
            }
          >
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="ps-6">{L("Content", "المحتوى")}</TableHead>
                  <TableHead>{L("Result", "النتيجة")}</TableHead>
                  <TableHead className="pe-6 text-end">{L("Actions", "الإجراءات")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.item_id} className={cn(!r.eligible && "bg-rose-50/30")}>
                    <TableCell className="ps-6">
                      <div className="flex items-center gap-2.5">
                        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#f5f6fa] text-muted-foreground">
                          {r.type === "video" ? <PlayCircle className="size-4" /> : <FileText className="size-4" />}
                        </span>
                        <div className="min-w-0">
                          <div className="max-w-[300px] truncate font-medium">{r.title}</div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><span className="size-1.5 rounded-full" style={{ background: ta(r.therapy_area)?.color }} />{ta(r.therapy_area)?.[lang]}</span>
                            <span className="font-mono text-[10.5px]">{r.approval_code}</span>
                            {r.pipeline && (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-px text-[10.5px] font-medium text-brand-700 hover:bg-brand-100"><Workflow className="size-3" />{L("Video pipeline", "مسار الفيديو")}</button>
                                </PopoverTrigger>
                                <PopoverContent align="start" className="w-80">
                                  <ol className="space-y-2">
                                    {r.pipeline.map((p) => (
                                      <li key={p.step} className="grid grid-cols-[auto_1fr] gap-x-2.5 text-xs">
                                        <span className={cn("mt-1 size-2 rounded-full", p.mode === "real" ? "bg-emerald-500" : "bg-amber-400")} />
                                        <div>
                                          <span className="font-medium capitalize">{p.step}</span>
                                          <span className={cn("ms-1.5 rounded px-1 text-[10px] font-medium", p.mode === "real" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>{p.mode === "real" ? L("live", "فعلي") : L("simulated", "محاكاة")}</span>
                                          <div className="text-muted-foreground">{p.detail}</div>
                                        </div>
                                      </li>
                                    ))}
                                  </ol>
                                </PopoverContent>
                              </Popover>
                            )}
                          </div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[10.5px] font-medium">
                        {r.promotional ? <Tag tone="ember">{L("Promotional", "ترويجي")}</Tag> : <Tag>{L("Non-promotional", "غير ترويجي")}</Tag>}
                        <Tag>{r.gated ? L("Registered only", "للمسجلين") : L("Public", "عام")}</Tag>
                        {pinned.has(r.item_id) && <Tag tone="brand">{L("Pinned", "مثبّت")}</Tag>}
                        {blocked.has(r.item_id) && <Tag tone="rose">{L("Blocked", "محظور")}</Tag>}
                            <span className="num ms-1 font-normal text-muted-foreground">{L("Valid until", "صالح حتى")} {r.expiry_date}</span>
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {r.eligible ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700"><CheckCircle2 className="size-4" />{L("Shown", "معروض")}</span>
                      ) : (
                        <span className="inline-flex items-start gap-1.5 text-xs text-rose-700">
                          <XCircle className="mt-px size-4 shrink-0" />
                          <span className="max-w-[180px]">{ruleText(r.rule, r.rule_text)}</span>
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="pe-6">
                      <div className="flex justify-end gap-1">
                        {r.status === "published" && r.rule !== "expired" ? (
                          <ConfirmButton
                            label={<><Clock4 className="size-3" />{L("Expire", "إنهاء")}</>}
                            confirm={L("Expire now?", "إنهاء الآن؟")}
                            title={L("Expire now: removed from every list, including the CRM", "إنهاء الصلاحية الآن: يُزال من كل القوائم بما فيها نظام إدارة العملاء")}
                            onConfirm={() => expire.mutate(r.item_id)}
                          />
                        ) : (
                          <Button size="xs" variant="ghost" onClick={() => restore.mutate(r.item_id)} title={L("Restore original dates", "استعادة التواريخ الأصلية")}><RotateCcw className="size-3" /></Button>
                        )}
                        {pinned.has(r.item_id) || blocked.has(r.item_id) ? (
                          <Button size="xs" variant="ghost" onClick={() => clear.mutate(r.item_id)}>{L("Clear", "إلغاء")}</Button>
                        ) : (
                          <>
                            <Button size="xs" variant="ghost" title={L(`Pin in ${market}`, `تثبيت في ${market}`)} onClick={() => override.mutate({ action: "pin", country, therapy_area: r.therapy_area, item_id: r.item_id })}><Pin className="size-3.5" /></Button>
                            <ConfirmButton
                              ghost
                              label={<Ban className="size-3.5" />}
                              confirm={L("Block?", "حظر؟")}
                              title={L(`Block in ${market}`, `حظر في ${market}`)}
                              onConfirm={() => override.mutate({ action: "block", country, item_id: r.item_id })}
                            />
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Panel>
          <div className="space-y-6">
            <Panel title={L("Market rules", "قواعد الأسواق")} sub={L("Sample values for the demo; the final rule sheet comes from your regulatory team.", "قيم تجريبية للعرض؛ تأتي القواعد النهائية من فريقكم التنظيمي.")}>
              <ul className="space-y-2.5 text-sm">
                {cfg && Object.entries(d.country_rules).map(([c, r]) => (
                  <li key={c} className={cn("flex items-center justify-between gap-2", c === country && "font-semibold")}>
                    <span>{cfg.countries[c]?.[lang]}</span>
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", r.promotional_allowed ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700")}>
                      {r.promotional_allowed ? L("Promotional allowed", "الترويجي مسموح") : L("No promotional", "بدون ترويجي")}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
            <Panel title={L("Rules that always apply", "قواعد ثابتة")}>
              <ul className="space-y-2.5 text-xs leading-relaxed text-muted-foreground">
                <li className="flex gap-2"><CheckCircle2 className="mt-px size-3.5 shrink-0 text-brand-600" />{L("Only approved, published and in-date content is ever ranked.", "لا يُرتَّب إلا المحتوى المعتمد والمنشور والساري.")}</li>
                <li className="flex gap-2"><CheckCircle2 className="mt-px size-3.5 shrink-0 text-brand-600" />{L("Promotional content only for verified HCPs, where the market allows it.", "المحتوى الترويجي للأطباء الموثقين فقط حيث يسمح السوق.")}</li>
                <li className="flex gap-2"><CheckCircle2 className="mt-px size-3.5 shrink-0 text-brand-600" />{L("Expired or withdrawn content leaves every list immediately.", "يُزال المحتوى المنتهي أو المسحوب من كل القوائم فوراً.")}</li>
                <li className="flex gap-2"><CheckCircle2 className="mt-px size-3.5 shrink-0 text-brand-600" />{L("No experiment can relax these rules.", "لا يمكن لأي تجربة تخفيف هذه القواعد.")}</li>
              </ul>
            </Panel>
          </div>
        </div>
      )}
    </div>
  )
}

function Tag({ tone, children }: { tone?: "ember" | "brand" | "rose"; children: React.ReactNode }) {
  return (
    <span className={cn("rounded-full px-2 py-0.5", tone === "ember" ? "bg-ember-50 text-ember-600" : tone === "brand" ? "bg-brand-50 text-brand-700" : tone === "rose" ? "bg-rose-50 text-rose-700" : "bg-[#f5f6fa] text-foreground/70")}>
      {children}
    </span>
  )
}

// Two-step action: the first click arms it, the second (within 4 s) confirms. No browser dialog.
function ConfirmButton({ label, confirm, title, onConfirm, ghost }: { label: React.ReactNode; confirm: string; title: string; onConfirm: () => void; ghost?: boolean }) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const tm = setTimeout(() => setArmed(false), 4000)
    return () => clearTimeout(tm)
  }, [armed])
  return armed ? (
    <Button size="xs" className="rounded-full bg-rose-600 text-white hover:bg-rose-700" onClick={() => { setArmed(false); onConfirm() }} autoFocus>
      {confirm}
    </Button>
  ) : (
    <Button size="xs" variant={ghost ? "ghost" : "outline"} className={ghost ? undefined : "rounded-full"} title={title} aria-label={title} onClick={() => setArmed(true)}>
      {label}
    </Button>
  )
}
