// Overview: engagement and recommendation performance (requirements §8 online metrics).
import { useQuery } from "@tanstack/react-query"
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { FileText, PlayCircle } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { api } from "@/lib/api"
import { LEVEL_LABEL, SLOT_LABEL, useAdmin } from "@/lib/admin-i18n"
import { LoadError } from "@/components/load-error"
import { useConfig } from "@/lib/hooks"
import { Kpi, PageHeader, Panel } from "./ConsoleLayout"

const AXIS = { fontSize: 11, fill: "#5b6280" }
const TIP = { fontSize: 12, borderRadius: 10, border: "1px solid #e3e6f0", boxShadow: "0 8px 24px rgba(13,19,48,.08)" }

export default function Analytics() {
  const { L, ar, lang, n, pct } = useAdmin()
  const q = useQuery({ queryKey: ["analytics"], queryFn: api.analytics, refetchInterval: 5000 })
  const cfg = useConfig()
  const d = q.data
  const ta = (id: string) => cfg?.therapy_areas.find((t) => t.id === id)
  const levels = d?.by_level.map((r) => ({ ...r, name: (LEVEL_LABEL[r.level] ?? [r.level, r.level])[ar ? 1 : 0] })) ?? []
  const day = (v: string) => new Date(v).toLocaleDateString(ar ? "ar-AE-u-nu-latn" : "en-GB", { day: "numeric", month: "short" })

  return (
    <div className="pb-12">
      <PageHeader
        title={L("Overview", "نظرة عامة")}
        sub={L(
          "How HCPs engage with recommended content across all eight markets, over the last 30 days.",
          "كيف يتفاعل الأطباء مع المحتوى الموصى به في الأسواق الثمانية خلال آخر 30 يوماً.",
        )}
        right={d && (
          <div className="flex items-center gap-2 rounded-full border border-black/[0.06] bg-white px-4 py-2 text-xs text-muted-foreground">
            <span className="size-2 rounded-full bg-emerald-500" />
            {L("Live session", "الجلسة الحالية")}: <b className="num text-foreground">{n(d.live_run.events)}</b> {L("events", "حدث")}
          </div>
        )}
      />
      {q.isError && <div className="p-8"><LoadError onRetry={() => q.refetch()} /></div>}
      {q.isLoading && (
        <div className="space-y-6 px-8 pt-6" aria-busy="true" aria-label={L("Loading", "جارٍ التحميل")}>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-[118px] animate-pulse rounded-2xl bg-[#eef0f6]" />)}
          </div>
          <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
            <div className="h-80 animate-pulse rounded-2xl bg-[#eef0f6]" />
            <div className="h-80 animate-pulse rounded-2xl bg-[#eef0f6]" />
          </div>
        </div>
      )}
      {d && (
        <div className="space-y-6 px-8 pt-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Kpi label={L("Click-through rate", "معدل النقر")} value={pct(d.kpis.ctr)} sub={L(`${n(d.kpis.clicks)} clicks from ${n(d.kpis.impressions)} recommendations`, `${n(d.kpis.clicks)} نقرة من ${n(d.kpis.impressions)} توصية`)} />
            <Kpi label={L("Completion after click", "الإكمال بعد النقر")} value={pct(d.kpis.completion_after_click)} sub={L("Read past 60% or watched to the end", "قراءة أكثر من 60% أو مشاهدة كاملة")} />
            <Kpi label={L("Return visits", "الزيارات المتكررة")} value={pct(d.kpis.return_visits)} sub={L("HCPs back within 30 days", "أطباء عادوا خلال 30 يوماً")} />
            <Kpi label={L("Active HCPs, last 30 days", "الأطباء النشطون خلال 30 يوماً")} value={n(d.kpis.active_hcps)} sub={L(`${n(d.kpis.sessions)} sessions`, `${n(d.kpis.sessions)} جلسة`)} />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
            <Panel title={L("Daily engagement", "التفاعل اليومي")} sub={L("Events captured per day", "الأحداث المسجلة يومياً")}>
              <div className="h-64" dir="ltr">
                <ResponsiveContainer>
                  <AreaChart data={d.daily} margin={{ left: -12, right: 8, top: 6 }}>
                    <defs>
                      <linearGradient id="ev" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#1534c4" stopOpacity={0.22} />
                        <stop offset="100%" stopColor="#1534c4" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="#eef0f6" />
                    <XAxis dataKey="day" tickFormatter={day} tick={AXIS} tickLine={false} axisLine={false} minTickGap={28} reversed={ar} />
                    <YAxis tick={AXIS} tickLine={false} axisLine={false} orientation={ar ? "right" : "left"} />
                    <Tooltip contentStyle={TIP} labelFormatter={(v) => day(String(v))} formatter={(v) => [n(Number(v)), L("Events", "الأحداث")]} />
                    <Area type="monotone" dataKey="events" stroke="#1534c4" strokeWidth={2} fill="url(#ev)" activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Panel>
            <Panel title={L("Which personalisation level works", "أي مستوى تخصيص يحقق نتائج")} sub={L("Click-through rate by the level that placed the item", "معدل النقر حسب المستوى الذي اختار المحتوى")}>
              <div className="h-64" dir="ltr">
                <ResponsiveContainer>
                  <BarChart data={levels} layout="vertical" margin={{ left: 4, right: 16 }} barCategoryGap={10}>
                    <CartesianGrid horizontal={false} stroke="#eef0f6" />
                    <XAxis type="number" tickFormatter={(v) => `${Math.round(v * 100)}%`} tick={AXIS} tickLine={false} axisLine={false} reversed={ar} />
                    <YAxis type="category" dataKey="name" tick={{ ...AXIS, fill: "#0d1330" }} tickLine={false} axisLine={false} width={128} orientation={ar ? "right" : "left"} />
                    <Tooltip contentStyle={TIP} cursor={{ fill: "#f5f6fa" }} formatter={(v) => [pct(Number(v)), L("Click-through", "معدل النقر")]} />
                    <Bar dataKey="ctr" fill="#1534c4" radius={ar ? [4, 0, 0, 4] : [0, 4, 4, 0]} barSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
            <Panel title={L("Top content", "المحتوى الأكثر تفاعلاً")} sub={L("Most opened items", "أكثر المحتويات فتحاً")} flush>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="ps-6">{L("Content", "المحتوى")}</TableHead>
                    <TableHead className="text-end">{L("Opens", "مرات الفتح")}</TableHead>
                    <TableHead className="text-end">{L("Completed", "مكتمل")}</TableHead>
                    <TableHead className="pe-6 text-end">{L("HCPs", "الأطباء")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.top_content.map((r) => (
                    <TableRow key={r.item_id}>
                      <TableCell className="ps-6">
                        <div className="flex items-center gap-2.5">
                          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#f5f6fa] text-muted-foreground">
                            {r.type === "video" ? <PlayCircle className="size-4" /> : <FileText className="size-4" />}
                          </span>
                          <div className="min-w-0">
                            <div className="max-w-[360px] truncate font-medium">{r.title?.[lang] ?? r.title?.en}</div>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <span className="size-1.5 rounded-full" style={{ background: ta(r.therapy_area)?.color }} />
                              {ta(r.therapy_area)?.[lang]}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="num text-end">{n(r.opens)}</TableCell>
                      <TableCell className="num text-end">{n(r.completions)}</TableCell>
                      <TableCell className="num pe-6 text-end">{n(r.hcps)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Panel>
            <div className="space-y-6">
              <Panel title={L("Engagement by therapy area", "التفاعل حسب المجال العلاجي")}>
                <div className="space-y-3.5">
                  {d.by_ta.map((r) => {
                    const max = Math.max(...d.by_ta.map((x) => x.opens), 1)
                    return (
                      <div key={r.ta}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2"><span className="size-2 rounded-full" style={{ background: ta(r.ta)?.color }} />{ta(r.ta)?.[lang] ?? r.ta}</span>
                          <span className="num text-muted-foreground">{n(r.opens)}</span>
                        </div>
                        <div className="mt-1.5 h-1.5 rounded-full bg-[#f0f1f6]"><div className="h-full rounded-full bg-brand-600" style={{ width: `${(r.opens / max) * 100}%` }} /></div>
                      </div>
                    )
                  })}
                </div>
              </Panel>
              <div className="grid grid-cols-2 gap-4">
                <Kpi label={L("Catalogue reached", "تغطية المكتبة")} value={pct(d.kpis.catalogue_coverage, 0)} sub={L("of eligible items", "من المحتوى المؤهل")} />
                <Kpi label={L("Sessions served", "الجلسات المستفيدة")} value={pct(d.kpis.session_coverage, 0)} sub={L("used a recommendation", "استخدمت توصية")} />
              </div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1fr_1.6fr]">
            <Panel title={L("By placement", "حسب موضع العرض")} flush>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="ps-6">{L("Placement", "الموضع")}</TableHead>
                    <TableHead className="text-end">{L("Shown", "مرات العرض")}</TableHead>
                    <TableHead className="pe-6 text-end">{L("Click-through", "معدل النقر")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.by_slot.map((r) => (
                    <TableRow key={r.slot}>
                      <TableCell className="ps-6 font-medium">{(SLOT_LABEL[r.slot] ?? [r.slot, r.slot])[ar ? 1 : 0]}</TableCell>
                      <TableCell className="num text-end">{n(r.impressions)}</TableCell>
                      <TableCell className="num pe-6 text-end">{pct(r.ctr)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Panel>
            <Panel title={L("Reach by market", "الانتشار حسب السوق")} sub={L("Is any market or language under-served?", "هل هناك سوق أو لغة لا تحصل على خدمة كافية؟")}>
              <div className="grid gap-x-8 sm:grid-cols-2">
                {d.by_country.map((r) => (
                  <div key={`${r.country}-${r.language}`} className="flex items-center justify-between border-b border-black/[0.05] py-2.5 text-sm">
                    <span className="flex items-center gap-2">
                      {cfg?.countries[r.country]?.[lang] ?? r.country}
                      <span className="rounded-full bg-[#f5f6fa] px-1.5 py-px text-[10.5px] font-medium text-muted-foreground">{r.language === "ar" ? L("Arabic", "عربي") : L("English", "إنجليزي")}</span>
                    </span>
                    <span className="num text-xs text-muted-foreground">{n(r.hcps)} {L("HCPs", "طبيب")} · {n(r.opens)} {L("opens", "فتح")}</span>
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          <p className="text-xs text-muted-foreground">
            {L("History is generated sample data for the demo; activity from this session is added live.", "السجل بيانات تجريبية مولّدة للعرض، ويُضاف نشاط هذه الجلسة مباشرة.")}
          </p>
        </div>
      )}
    </div>
  )
}
