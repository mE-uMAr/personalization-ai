// Experiments: one example A/B result, computed from the impression log.
import { useQuery } from "@tanstack/react-query"
import { AlertTriangle, FlaskConical, Hash, ShieldCheck, Trophy } from "lucide-react"
import { api } from "@/lib/api"
import { SLOT_LABEL, useAdmin } from "@/lib/admin-i18n"
import { PageHeader, Panel } from "./ConsoleLayout"

export default function AbResults() {
  const { L, n, pct } = useAdmin()
  const q = useQuery({ queryKey: ["ab"], queryFn: api.ab })
  const d = q.data
  const a = d?.arms.find((x) => x.variant === "A")
  const b = d?.arms.find((x) => x.variant === "B")
  const maxCtr = Math.max(a?.ctr ?? 0, b?.ctr ?? 0) || 1
  const won = !!d && (d.lift ?? 0) > 0 && (d.lift_ci?.[0] ?? 0) > 0
  const armLabel = (v: string, label: string) => (v === "A" ? L("Editor-curated lists (control)", "قوائم المحررين (المجموعة الضابطة)") : v === "B" ? L("Personalised ranking", "الترتيب المخصص") : label)

  return (
    <div className="pb-12">
      <PageHeader
        title={L("Experiments", "التجارب")}
        sub={L("Test changes to recommendations on a share of HCPs and roll out only what measurably works.", "اختبر التغييرات على التوصيات لدى جزء من الأطباء ولا تعمّم إلا ما يثبت نجاحه.")}
      />
      {d && a && b && (
        <div className="space-y-6 px-8 pt-6">
          <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 px-5 py-4 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div>
              {L(
                "Example result on simulated traffic. Group assignment, logging and the statistics are the production code; live results start after the agreed baseline period.",
                "نتيجة مثال على حركة محاكاة. توزيع المجموعات والتسجيل والإحصاءات هي شيفرة الإنتاج نفسها؛ تبدأ النتائج الفعلية بعد فترة القياس المتفق عليها.",
              )}
            </div>
          </div>
          <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
            <Panel
              title={L("Personalised vs editor-curated", "المخصص مقابل قوائم المحررين")}
              sub={L(`${(SLOT_LABEL["home_recommended"])[0]} · click-through · 50/50 split, each HCP stays in one group`, `${(SLOT_LABEL["home_recommended"])[1]} · معدل النقر · تقسيم 50/50 ويبقى كل طبيب في مجموعة واحدة`)}
              right={<FlaskConical className="size-4 text-muted-foreground" />}
            >
              <div className="space-y-6">
                {[a, b].map((arm) => (
                  <div key={arm.variant}>
                    <div className="mb-2 flex items-baseline justify-between gap-3">
                      <span className="flex items-center gap-2.5 text-sm font-medium">
                        <span className="grid size-7 place-items-center rounded-lg bg-[#f5f6fa] text-xs font-bold">{arm.variant}</span>
                        {armLabel(arm.variant, arm.label)}
                        {arm.variant === "B" && won && <Trophy className="size-4 text-ember-500" />}
                      </span>
                      <span className="num text-2xl font-semibold">{pct(arm.ctr, 2)}</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-[#eef0f6]">
                      <div className="h-full rounded-full" style={{ width: `${(arm.ctr / maxCtr) * 100}%`, background: arm.variant === "B" ? "#1534c4" : "#9aa0b4" }} />
                    </div>
                    <div className="num mt-1.5 text-xs text-muted-foreground">
                      {L(`${n(arm.clicks)} clicks · ${n(arm.impressions)} recommendations · ${n(arm.hcps)} HCPs`, `${n(arm.clicks)} نقرة · ${n(arm.impressions)} توصية · ${n(arm.hcps)} طبيب`)}
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel title={L("Result", "النتيجة")}>
              <div className="text-xs text-muted-foreground">{L("Uplift in click-through (B vs A)", "التحسن في معدل النقر (B مقابل A)")}</div>
              <div className="num mt-1 text-5xl font-semibold tracking-tight text-brand-700" dir="ltr">+{pct(d.lift ?? 0, 1)}</div>
              <div className="num mt-2 text-xs text-muted-foreground" dir="ltr">
                95% CI {pct(d.lift_ci?.[0] ?? 0, 1)} – {pct(d.lift_ci?.[1] ?? 0, 1)} · p = {d.p_value}
              </div>
              <div className="relative mt-6 h-8" dir="ltr">
                <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
                {(() => {
                  const lo = d.lift_ci?.[0] ?? 0, hi = d.lift_ci?.[1] ?? 0, span = Math.max(Math.abs(lo), Math.abs(hi)) * 1.3 || 1
                  const x = (v: number) => `${50 + (v / span) * 50}%`
                  return (
                    <>
                      <div className="absolute top-1/2 h-4 w-px -translate-y-1/2 bg-foreground/40" style={{ left: "50%" }} />
                      <div className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-brand-200" style={{ left: x(lo), right: `calc(100% - ${x(hi)})` }} />
                      <div className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-700 ring-2 ring-white" style={{ left: x(d.lift ?? 0) }} />
                    </>
                  )
                })()}
              </div>
              <p className="mt-3 text-sm">
                {won
                  ? L("Personalised ranking wins with statistical confidence.", "الترتيب المخصص يتفوق بثقة إحصائية.")
                  : L("No confident winner yet; keep the test running.", "لا يوجد فائز مؤكد بعد؛ استمر في الاختبار.")}
              </p>
              {d.small_sample && <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-700"><AlertTriangle className="size-3.5" />{L("Sample is small; treat with caution.", "العينة صغيرة؛ يُرجى الحذر.")}</p>}
              <button className="mt-6 h-10 w-full rounded-full bg-brand-700 text-sm font-semibold text-white opacity-50" disabled title={L("Available in the full build", "متاح في النسخة الكاملة")}>
                {L("Roll out B to all HCPs", "تعميم B على جميع الأطباء")}
              </button>
            </Panel>
          </div>
          <Panel title={L("How experiments run", "كيف تعمل التجارب")}>
            <ul className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
              <Li icon={Hash} t={L("Consistent groups", "مجموعات ثابتة")} d={L("Each HCP stays in the same group across sessions and devices.", "يبقى كل طبيب في المجموعة نفسها عبر الجلسات والأجهزة.")} />
              <Li icon={FlaskConical} t={L("What can be tested", "ما يمكن اختباره")} d={L("Ranking, weights, layout or number of items, per placement.", "الترتيب أو الأوزان أو التخطيط أو عدد العناصر لكل موضع.")} />
              <Li icon={ShieldCheck} t={L("Rules never relax", "القواعد لا تتغير")} d={L("No test group can bypass market and compliance rules.", "لا يمكن لأي مجموعة تجاوز قواعد السوق والامتثال.")} />
              <Li icon={Trophy} t={L("Fully traceable", "قابلة للتتبع بالكامل")} d={L("Every recommendation records its group, so results can be recomputed.", "كل توصية تسجّل مجموعتها، فيمكن إعادة حساب النتائج.")} />
            </ul>
          </Panel>
        </div>
      )}
    </div>
  )
}

function Li({ icon: Icon, t, d }: { icon: React.ElementType; t: string; d: string }) {
  return (
    <li className="rounded-xl border border-black/[0.06] p-4">
      <div className="flex items-center gap-2 font-semibold"><Icon className="size-4 text-brand-600" />{t}</div>
      <div className="mt-1 text-xs leading-relaxed text-muted-foreground">{d}</div>
    </li>
  )
}
