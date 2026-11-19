// Audit trail: every recommendation shown to an HCP, with the reason, for regulatory inspection.
import { Fragment, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ChevronRight, ShieldCheck } from "lucide-react"
import { LevelBadge } from "@/components/brand"
import { COMPONENT_COLOR, COMPONENT_ORDER, StackBarLight } from "./stack"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { api } from "@/lib/api"
import { SLOT_LABEL, useAdmin } from "@/lib/admin-i18n"
import { useConfig } from "@/lib/hooks"
import { useSession } from "@/lib/session"
import { cn } from "@/lib/utils"
import { HcpPicker } from "./HcpPicker"
import { PageHeader, Panel } from "./ConsoleLayout"

export default function Inspector() {
  const { L, lang, ar, dateTime } = useAdmin()
  const { hcpId } = useSession()
  const cfg = useConfig()
  const q = useQuery({ queryKey: ["impressions", hcpId, lang], queryFn: () => api.impressions(hcpId!, lang), enabled: !!hcpId, refetchInterval: 4000 })
  const [open, setOpen] = useState<string | null>(null)
  const rows = q.data?.impressions ?? []
  const max = Math.max(...rows.map((r) => r.score), 0.0001)
  const comp = (k: string) => cfg?.component_labels[k]?.[lang] ?? k
  const taName = (id?: string) => (id ? cfg?.therapy_areas.find((t) => t.id === id)?.[lang] ?? id : "—")

  return (
    <div className="pb-12">
      <PageHeader
        title={L("Audit trail", "سجل التدقيق")}
        sub={L("Every recommendation shown is recorded: when, where on the page, in what position, by which engine version and with which reason.", "يُسجَّل كل محتوى موصى به: متى، وأين في الصفحة، وبأي ترتيب، وبأي إصدار للمحرك، وبأي سبب.")}
        right={<HcpPicker />}
      />
      <div className="px-8 pt-6">
        <Panel
          flush
          title={L(`${rows.length} most recent recommendations`, `آخر ${rows.length} توصية`)}
          right={
            <div className="hidden flex-wrap gap-x-3 gap-y-1 2xl:flex">
              {COMPONENT_ORDER.map((k) => <span key={k} className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><span className="size-2 rounded-sm" style={{ background: COMPONENT_COLOR[k] }} />{comp(k)}</span>)}
            </div>
          }
        >
          {!hcpId ? (
            <div className="flex flex-col items-center gap-2 px-6 py-16 text-center text-sm text-muted-foreground">
              <ShieldCheck className="size-8 text-brand-300" />
              {L("Choose an HCP to see their audit trail.", "اختر طبيباً لعرض سجل التدقيق.")}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="ps-6">{L("Date & time", "التاريخ والوقت")}</TableHead>
                  <TableHead>{L("Placement · engine", "الموضع · المحرك")}</TableHead>
                  <TableHead>{L("Content · reason shown to HCP", "المحتوى · السبب المعروض للطبيب")}</TableHead>
                  <TableHead>{L("Level", "المستوى")}</TableHead>
                  <TableHead className="hidden w-[200px] pe-6 2xl:table-cell">{L("Score makeup", "مكونات الدرجة")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <Fragment key={r.impression_id}>
                    <TableRow className="cursor-pointer" onClick={() => setOpen(open === r.impression_id ? null : r.impression_id)}>
                      <TableCell className="num ps-6 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><ChevronRight className={cn("size-3.5 transition rtl:rotate-180", open === r.impression_id && "rotate-90 rtl:rotate-90")} /><span className="whitespace-nowrap">{dateTime(r.ts)}</span></span>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div>{(SLOT_LABEL[r.slot] ?? [r.slot, r.slot])[ar ? 1 : 0]} · <span className="num">#{r.rank + 1}</span></div>
                        <div className="mt-0.5 whitespace-nowrap font-mono text-[10.5px] text-muted-foreground" dir="ltr">{r.model_version} · {L("group", "مجموعة")} {r.experiment_variant ?? "—"}</div>
                      </TableCell>
                      <TableCell className="max-w-[240px] 2xl:max-w-[320px]">
                        <div className="truncate font-medium">{r.title}</div>
                        <div className="mt-0.5 truncate text-xs text-muted-foreground" title={r.reason}>{r.reason}</div>
                      </TableCell>
                      <TableCell className="pe-6 2xl:pe-2"><LevelBadge level={r.level} /></TableCell>
                      <TableCell className="hidden pe-6 2xl:table-cell">{r.signals.components && Object.keys(r.signals.components).length ? <StackBarLight components={r.signals.components} max={max} /> : <span className="text-xs text-muted-foreground">{L("Editor list", "قائمة المحرر")}</span>}</TableCell>
                    </TableRow>
                    {open === r.impression_id && (
                      <TableRow className="bg-[#f7f8fb] hover:bg-[#f7f8fb]">
                        <TableCell colSpan={5} className="px-6 py-4">
                          <div className="grid gap-6 text-xs md:grid-cols-3">
                            <div className="space-y-1">
                              <div className="mb-1.5 font-semibold">{L("Score breakdown", "تفاصيل الدرجة")}</div>
                              {Object.entries(r.signals.components ?? {}).map(([k, v]) => (
                                <div key={k} className="flex justify-between gap-4"><span className="text-muted-foreground">{comp(k)}</span><span className="num">{v.toFixed(3)}</span></div>
                              ))}
                              <div className="flex justify-between gap-4 border-t pt-1 font-medium"><span>{L("Total", "المجموع")}</span><span className="num">{r.score.toFixed(3)}</span></div>
                            </div>
                            <div className="space-y-1">
                              <div className="mb-1.5 font-semibold">{L("Context", "السياق")}</div>
                              <div className="flex justify-between gap-4"><span className="text-muted-foreground">{L("Personal share", "نسبة التخصيص")}</span><span className="num">{Math.round((r.signals.alpha ?? 0) * 100)}%</span></div>
                              <div className="flex justify-between gap-4"><span className="text-muted-foreground">{L("Landing therapy area", "المجال الرئيسي")}</span><span>{taName(r.signals.landing_ta)}</span></div>
                              <div className="flex justify-between gap-4"><span className="text-muted-foreground">{L("Peer segment", "شريحة الزملاء")}</span><span className="num">{r.signals.cluster_id ?? "—"}</span></div>
                              <div className="flex justify-between gap-4"><span className="text-muted-foreground">{L("Fallback", "الوضع الاحتياطي")}</span><span>{r.signals.fallback ? L("Editor list", "قائمة المحرر") : L("None", "لا يوجد")}</span></div>
                            </div>
                            <div className="space-y-1">
                              <div className="mb-1.5 font-semibold">{L("Record", "السجل")}</div>
                              <div className="flex justify-between gap-4"><span className="text-muted-foreground">{L("Engine version", "إصدار المحرك")}</span><span className="font-mono text-[11px]">{r.model_version}</span></div>
                              <div className="flex justify-between gap-4"><span className="text-muted-foreground">{L("Experiment group", "مجموعة التجربة")}</span><span className="font-mono text-[11px]">{r.experiment_variant ?? "—"}</span></div>
                              <div className="flex justify-between gap-4"><span className="text-muted-foreground">{L("Record ID", "معرّف السجل")}</span><span className="font-mono text-[10.5px]">{r.impression_id.slice(0, 18)}</span></div>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          )}
        </Panel>
      </div>
    </div>
  )
}
