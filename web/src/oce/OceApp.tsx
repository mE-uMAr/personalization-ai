// CRM rep view: what a field rep sees for each HCP once the engine's data reaches IQVIA OCE.
// A neutral stand-in (no live OCE connection in the demo); bilingual, follows the admin language.
import { useEffect, useState } from "react"
import { Link, useSearchParams } from "react-router"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft, Braces, CircleDot, FileText, Languages, PlayCircle, RefreshCw, Search, ShieldOff, Sparkles, UserRound } from "lucide-react"
import { BrandMark } from "@/components/brand"
import { DirectionProvider } from "@/components/ui/direction"
import { api, ApiError, type OceAccount } from "@/lib/api"
import { adminLang, useAdmin } from "@/lib/admin-i18n"
import { useConfig } from "@/lib/hooks"
import { cn } from "@/lib/utils"

const EV: Record<string, [string, string]> = {
  item_open: ["Opened", "فتح"],
  article_read: ["Read article", "قرأ مقالاً"],
  video_progress: ["Watched video", "شاهد فيديو"],
  dismiss: ["Marked not relevant", "حدده غير مناسب"],
  save: ["Saved", "حفظ"],
}

export default function OceApp() {
  const { L, lang, dir, time } = useAdmin()
  const cfg = useConfig()
  const [sp, setSp] = useSearchParams()
  const [q, setQ] = useState("")
  const selected = sp.get("account")
  const list = useQuery({ queryKey: ["oce", "list", q, lang], queryFn: () => api.oceAccounts(q || undefined, lang), refetchInterval: 4000 })
  const acc = useQuery({ queryKey: ["oce", "acc", selected, lang], queryFn: () => api.oceAccount(selected!, lang), enabled: !!selected, refetchInterval: 3000, retry: false })
  const [raw, setRaw] = useState(false)

  useEffect(() => {
    if (!selected && list.data?.accounts[0]) setSp({ account: list.data.accounts[0].hcp_id }, { replace: true })
  }, [selected, list.data, setSp])

  return (
    <DirectionProvider dir={dir}>
      <div className="flex min-h-svh flex-col bg-[#f5f6fa] text-[13.5px] text-[#0d1330]" dir={dir} lang={lang}>
        <header className="flex h-16 items-center gap-4 border-b border-black/[0.06] bg-white px-6">
          <Link to="/" className="rounded-full p-2 text-muted-foreground hover:bg-[#f5f6fa]" aria-label={L("Back", "رجوع")}><ArrowLeft className="size-4 rtl:rotate-180" /></Link>
          <BrandMark className="size-8" />
          <div className="leading-tight">
            <div className="font-semibold">{L("Field rep view", "عرض المندوب الميداني")}</div>
            <div className="text-xs text-muted-foreground">{L("As delivered to IQVIA OCE · simulated in this demo", "كما يصل إلى IQVIA OCE · محاكاة في هذا العرض")}</div>
          </div>
          <div className="ms-auto flex items-center gap-3">
            <span className="hidden items-center gap-1.5 rounded-full bg-[#f5f6fa] px-3 py-1.5 text-xs text-muted-foreground md:flex">
              <RefreshCw className="size-3.5" />{L(`Syncs every ${list.data?.sync_seconds ?? "–"}s in the demo (production: 15 min)`, `مزامنة كل ${list.data?.sync_seconds ?? "–"} ث في العرض (الإنتاج: 15 دقيقة)`)}
            </span>
            <button onClick={() => adminLang.set(lang === "en" ? "ar" : "en")} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-black/10 bg-white px-3.5 text-sm font-medium hover:border-brand-300">
              <Languages className="size-4" />{lang === "en" ? "العربية" : "English"}
            </button>
          </div>
        </header>

        <div className="grid flex-1 grid-cols-[320px_1fr] gap-5 p-5">
          <aside className="flex flex-col overflow-hidden rounded-2xl border border-black/[0.06] bg-white">
            <div className="border-b border-black/[0.06] p-4">
              <div className="mb-3 font-semibold">{L("My HCPs", "أطبائي")}</div>
              <div className="flex items-center gap-2 rounded-full border border-black/10 px-3">
                <Search className="size-4 text-muted-foreground" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={L("Search by name", "ابحث بالاسم")} className="h-9 flex-1 bg-transparent outline-none" />
              </div>
              <p className="mt-2.5 text-[11.5px] text-muted-foreground">{L("Only HCPs who agreed to CRM sharing appear here.", "يظهر هنا فقط الأطباء الذين وافقوا على المشاركة مع CRM.")}</p>
            </div>
            <ul className="flex-1 overflow-y-auto p-2">
              {list.data?.accounts.map((a) => (
                <li key={a.hcp_id}>
                  <button onClick={() => setSp({ account: a.hcp_id })} className={cn("w-full rounded-xl px-3 py-2.5 text-start transition hover:bg-[#f5f6fa]", selected === a.hcp_id && "bg-brand-50 hover:bg-brand-50")}>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{a.full_name}</span>
                      {a.live && <span className="rounded-full bg-ember-50 px-1.5 text-[10px] font-semibold text-ember-600">{L("NEW", "جديد")}</span>}
                    </div>
                    <div className="text-xs text-muted-foreground">{a.specialty_label} · {cfg?.countries[a.country]?.[lang] ?? a.country}</div>
                    <div className="text-[11px] text-muted-foreground">{L(`${a.engagements} content items engaged`, `تفاعل مع ${a.engagements} محتوى`)}{a.last_sync ? ` · ${time(a.last_sync)}` : ""}</div>
                  </button>
                </li>
              ))}
              {list.data && list.data.accounts.length === 0 && (
                <li className="px-3 py-8 text-center text-sm text-muted-foreground">
                  {q ? L(`No HCP matches “${q}”. HCPs who did not agree to CRM sharing never appear here.`, `لا يوجد طبيب يطابق «${q}». لا يظهر هنا أبداً الأطباء الذين لم يوافقوا على المشاركة.`) : L("No HCPs shared with the CRM yet.", "لا يوجد أطباء مشاركون بعد.")}
                </li>
              )}
            </ul>
          </aside>

          <main className="min-w-0 space-y-5">
            {!selected && <div className="rounded-2xl border border-black/[0.06] bg-white p-10 text-center text-muted-foreground">{L("Choose an HCP.", "اختر طبيباً.")}</div>}
            {acc.isError && (
              <div className="flex items-start gap-3 rounded-2xl border border-black/[0.06] bg-white p-6">
                <ShieldOff className="size-6 text-rose-600" />
                <div>
                  <div className="font-semibold">{L("This HCP has no CRM record", "لا يوجد سجل CRM لهذا الطبيب")}</div>
                  <div className="text-muted-foreground">{String((acc.error as ApiError).detail ?? "")}</div>
                </div>
              </div>
            )}
            {acc.data && <Record a={acc.data} raw={raw} setRaw={setRaw} />}
          </main>
        </div>
      </div>
    </DirectionProvider>
  )
}

function Record({ a, raw, setRaw }: { a: OceAccount; raw: boolean; setRaw: (v: boolean) => void }) {
  const { L, lang, ar, time, dateTime } = useAdmin()
  const cfg = useConfig()
  const taName = (id: string, fallback: string) => cfg?.therapy_areas.find((t) => t.id === id)?.[lang] ?? fallback
  return (
    <>
      <div className="rounded-2xl border border-black/[0.06] bg-white">
        <div className="flex flex-wrap items-center gap-4 p-5">
          <span className="grid size-12 place-items-center rounded-full bg-brand-700 text-white"><UserRound className="size-6" /></span>
          <div className="min-w-0 flex-1">
            <div className="text-xl font-semibold">{a.name}</div>
            <div className="text-sm text-muted-foreground">{a.specialty_label} · {cfg?.countries[a.country]?.[lang] ?? a.country}</div>
          </div>
          <button onClick={() => setRaw(!raw)} className={cn("flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition", raw ? "border-brand-700 bg-brand-700 text-white" : "border-black/10 bg-white hover:border-brand-300")}>
            <Braces className="size-4" /> {raw ? L("Hide data payload", "إخفاء البيانات") : L("Data payload", "البيانات المرسلة")}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-px border-t border-black/[0.06] bg-black/[0.06] md:grid-cols-4">
          <F k={L("CRM ID", "معرّف CRM")} v={<span className="font-mono text-[12.5px]">{a.oce_id}</span>} />
          <F k={L("Peer segment", "شريحة الزملاء")} v={(ar ? a.segment?.label_ar : a.segment?.label_en) ?? "—"} />
          <F k={L("Main interest", "الاهتمام الرئيسي")} v={a.ta_affinity[0] ? taName(a.ta_affinity[0].ta, a.ta_affinity[0].name) : "—"} />
          <F k={L("Last update", "آخر تحديث")} v={a.sync.last ? time(a.sync.last) : "—"} />
        </div>
      </div>

      {raw ? (
        <div className="rounded-2xl bg-[#0d1330] p-5 text-[12px] text-[#d5e2ff]" dir="ltr">
          <div className="mb-2 flex items-center justify-between text-[11px] text-white/50">
            <span>{a.sync.adapter} · {a.sync.delivered} delivered · {a.sync.queued} queued</span>
            <span>pseudonymous ID {a.hcp_id}</span>
          </div>
          <pre className="max-h-[70svh] overflow-auto whitespace-pre-wrap font-mono leading-relaxed">{JSON.stringify(a.raw, null, 2)}</pre>
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">
          <Card title={L("Suggested content for the next visit", "محتوى مقترح للزيارة القادمة")} icon={Sparkles}>
            <ol className="space-y-2">
              {a.recommendations.map((r, i) => (
                <li key={r.item_id} className="flex gap-3 rounded-xl bg-[#f7f8fb] p-3">
                  <span className="num grid size-7 shrink-0 place-items-center rounded-full bg-white text-xs font-semibold ring-1 ring-black/10">{i + 1}</span>
                  <div className="min-w-0">
                    <div className="font-semibold">{r.title}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{r.reason}</div>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-[11.5px] text-muted-foreground">{L("All content is approved. Reasons are fixed, pre-approved wording.", "كل المحتوى معتمد، والأسباب صياغات ثابتة معتمدة مسبقاً.")}</p>
          </Card>
          <Card title={L("Therapy-area interest", "الاهتمام بالمجالات العلاجية")} icon={CircleDot}>
            <div className="space-y-3">
              {a.ta_affinity.map((t) => (
                <div key={t.ta}>
                  <div className="flex justify-between text-sm"><span>{taName(t.ta, t.name)}</span><span className="num text-muted-foreground">{Math.round(t.share * 100)}%</span></div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-[#eef0f6]"><div className="h-full rounded-full bg-brand-600" style={{ width: `${t.share * 100}%` }} /></div>
                </div>
              ))}
            </div>
          </Card>
          <Card title={a.engagement_total > a.engagement.length
            ? L(`Digital activity · latest ${a.engagement.length} of ${a.engagement_total} content items`, `النشاط الرقمي · آخر ${a.engagement.length} من ${a.engagement_total} محتوى`)
            : L(`Digital activity · ${a.engagement.length} content items`, `النشاط الرقمي · ${a.engagement.length} محتوى`)} icon={RefreshCw} className="xl:col-span-2">
            <table className="w-full">
              <thead>
                <tr className="border-b border-black/[0.06] text-xs text-muted-foreground">
                  <th className="py-2 text-start font-medium">{L("When", "متى")}</th>
                  <th className="text-start font-medium">{L("Activity", "النشاط")}</th>
                  <th className="text-start font-medium">{L("Content", "المحتوى")}</th>
                  <th className="text-end font-medium">{L("Received in CRM", "وصل إلى CRM")}</th>
                </tr>
              </thead>
              <tbody>
                {a.engagement.map((e, i) => (
                  <tr key={i} className="border-b border-black/[0.04]">
                    <td className="num py-2 pe-3 text-xs text-muted-foreground">{dateTime(e.timestamp)}</td>
                    <td className="pe-3">{(EV[e.event_type] ?? [e.event_type, e.event_type])[ar ? 1 : 0]}{e.event_type === "video_progress" && e.value ? ` · ${e.value}%` : ""}</td>
                    <td className="pe-3"><span className="flex items-center gap-1.5">{e.type === "video" ? <PlayCircle className="size-3.5 text-muted-foreground" /> : <FileText className="size-3.5 text-muted-foreground" />}<span>{e.title}</span></span></td>
                    <td className="num text-end text-xs text-muted-foreground">{e.delivered_at ? time(e.delivered_at) : L("queued", "في الانتظار")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}
    </>
  )
}

function F({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="bg-white px-5 py-3">
      <div className="text-xs text-muted-foreground">{k}</div>
      <div className="mt-0.5 truncate font-medium">{v}</div>
    </div>
  )
}

function Card({ title, icon: Icon, children, className }: { title: string; icon: React.ElementType; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border border-black/[0.06] bg-white", className)}>
      <h3 className="flex items-center gap-2 px-5 pb-1 pt-4 font-semibold"><Icon className="size-4 text-brand-600" />{title}</h3>
      <div className="p-5 pt-3">{children}</div>
    </section>
  )
}
