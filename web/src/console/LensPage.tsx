// HCP journey: one HCP, live, with the decision process in plain language.
import { Link } from "react-router"
import { ArrowUpRight, Eye, Filter, Pin, ScrollText, Shuffle, Sparkles, SquareStack } from "lucide-react"
import { EngineLens } from "@/components/engine-lens"
import { useAdmin } from "@/lib/admin-i18n"
import { useConfig } from "@/lib/hooks"
import { useSession } from "@/lib/session"
import { HcpPicker } from "./HcpPicker"
import { PageHeader, Panel } from "./ConsoleLayout"

export default function LensPage() {
  const { L, lang } = useAdmin()
  const { hcpId } = useSession()
  const cfg = useConfig()
  const e = cfg?.engine
  const label = (k: string) => cfg?.component_labels[k]?.[lang] ?? k

  const steps: [React.ElementType, string, string][] = [
    [Filter, L("Compliance filter first", "فلتر الامتثال أولاً"), L("Only approved, in-date content allowed in the HCP's market and access level.", "فقط المحتوى المعتمد والساري والمسموح في سوق الطبيب ومستوى وصوله.")],
    [Sparkles, L("Score every item", "تقييم كل محتوى"), L("Specialty, therapy-area interest, own behaviour and peers combined into one score.", "يُجمع التخصص والاهتمام والسلوك الفردي والزملاء في درجة واحدة.")],
    [Eye, L("Skip what's done", "تخطي المكتمل"), L("Finished items drop out; half-watched videos move to Continue watching.", "يُستبعد المكتمل وتنتقل الفيديوهات غير المكتملة إلى تابع المشاهدة.")],
    [Pin, L("Admin overrides win", "أولوية تدخل المسؤول"), L("Pinned launches and blocked items always beat the model.", "المحتوى المثبت أو المحظور يتقدم دائماً على النموذج.")],
    [SquareStack, L("Keep it varied", "التنوع"), L("No more than 3 items on one topic in a row of 6.", "لا أكثر من 3 عناصر من موضوع واحد في صف من 6.")],
    [Shuffle, L("Room for discovery", "مساحة للاستكشاف"), L("About 10% goes to newer or less-seen approved content.", "نحو 10% للمحتوى المعتمد الأحدث أو الأقل مشاهدة.")],
    [ScrollText, L("Explain and record", "الشرح والتسجيل"), L("Each item gets a pre-approved reason, and every impression is logged for audit.", "لكل عنصر سبب معتمد مسبقاً، وكل عرض يُسجَّل للتدقيق.")],
  ]

  return (
    <div className="pb-12">
      <PageHeader
        title={L("HCP journey", "رحلة الطبيب")}
        sub={L("Follow one HCP live: what they did, what the engine learned and why each item was recommended.", "تابع طبيباً واحداً مباشرة: ما فعله، وما تعلّمه المحرك، ولماذا أوصى بكل محتوى.")}
        right={
          <div className="flex items-center gap-2">
            <HcpPicker />
            <Link to="/site" className="inline-flex h-9 items-center gap-1.5 rounded-full bg-brand-700 px-4 text-sm font-medium text-white hover:bg-brand-800">
              {L("Open portal", "افتح البوابة")} <ArrowUpRight className="size-4 rtl:-scale-x-100" />
            </Link>
          </div>
        }
      />
      <div className="grid gap-6 px-8 pt-6 xl:grid-cols-[420px_1fr]">
        <div className="h-[calc(100svh-190px)] overflow-hidden rounded-2xl border border-black/[0.06] shadow-[0_1px_2px_rgba(13,19,48,0.04)]">
          <EngineLens hcpId={hcpId} lang={lang} />
        </div>
        <div className="space-y-6">
          <Panel title={L("How a recommendation is decided", "كيف تُتخذ التوصية")} sub={L("The same steps run on every page view, in this order.", "تُنفَّذ الخطوات نفسها في كل صفحة وبهذا الترتيب.")}>
            <ol className="grid gap-3 sm:grid-cols-2">
              {steps.map(([Icon, t, d], i) => (
                <li key={t} className="flex gap-3 rounded-xl border border-black/[0.06] p-4">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700"><Icon className="size-4" /></span>
                  <span>
                    <span className="block text-sm font-semibold"><span className="num me-1 text-muted-foreground">{i + 1}.</span>{t}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{d}</span>
                  </span>
                </li>
              ))}
            </ol>
          </Panel>
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title={L("New HCP (first visits)", "طبيب جديد (الزيارات الأولى)")} sub={L("Before the engine knows them", "قبل أن يتعرف عليه المحرك")}>
              <Weights parts={Object.entries(e?.cold_weights ?? {})} label={label} />
            </Panel>
            <Panel title={L("Known HCP", "طبيب معروف")} sub={L(`Fully personal after ${e?.cold_start_actions ?? 5} actions`, `مخصص بالكامل بعد ${e?.cold_start_actions ?? 5} تفاعلات`)}>
              <Weights parts={Object.entries(e?.personal_weights ?? {})} label={label} />
            </Panel>
          </div>
          <Panel title={L("When the landing therapy area changes", "متى يتغير المجال العلاجي الرئيسي")}>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2"><Dot />{L("A new HCP lands on the area that matches their declared specialty.", "يبدأ الطبيب الجديد من المجال المطابق لتخصصه المعلن.")}</li>
              <li className="flex gap-2"><Dot />{L(`Another area takes over only when it leads by ${Math.round((e?.switch_margin ?? 0.15) * 100)}%, so one stray click never flips the home page.`, `لا يتغير المجال إلا إذا تفوق مجال آخر بنسبة ${Math.round((e?.switch_margin ?? 0.15) * 100)}%، فلا تغيّر نقرة عابرة الصفحة الرئيسية.`)}</li>
              <li className="flex gap-2"><Dot />{L("Recent activity counts more than old activity (30-day half-life).", "النشاط الحديث أهم من القديم (نصف عمر 30 يوماً).")}</li>
              <li className="flex gap-2"><Dot />{L("All five areas always stay in the navigation; personalisation reorders, never hides.", "تبقى المجالات الخمسة ظاهرة دائماً؛ التخصيص يعيد الترتيب ولا يخفي.")}</li>
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  )
}

function Dot() {
  return <span className="mt-2 size-1.5 shrink-0 rounded-full bg-brand-600" />
}

function Weights({ parts, label }: { parts: [string, number][]; label: (k: string) => string }) {
  return (
    <div className="space-y-3">
      {parts.map(([k, v]) => (
        <div key={k}>
          <div className="flex justify-between text-sm"><span>{label(k)}</span><span className="num font-medium">{Math.round(v * 100)}%</span></div>
          <div className="mt-1.5 h-1.5 rounded-full bg-[#eef0f6]"><div className="h-full rounded-full bg-brand-600" style={{ width: `${v * 100}%` }} /></div>
        </div>
      ))}
    </div>
  )
}
