// Admin dashboard shell: bilingual (EN / AR, right-to-left), business-first navigation.
import { Link, NavLink, Outlet } from "react-router"
import { BarChart3, ExternalLink, FlaskConical, Languages, Network, Route, ScrollText, ShieldCheck } from "lucide-react"
import { BrandMark } from "@/components/brand"
import { DirectionProvider } from "@/components/ui/direction"
import { adminLang, useAdmin } from "@/lib/admin-i18n"
import { useDemoState, useHcp } from "@/lib/hooks"
import { cn } from "@/lib/utils"

const NAV = [
  { to: "/console", en: "Overview", ar: "نظرة عامة", icon: BarChart3, end: true },
  { to: "/console/journey", en: "HCP journey", ar: "رحلة الطبيب", icon: Route },
  { to: "/console/clusters", en: "Peer segments", ar: "شرائح الزملاء", icon: Network },
  { to: "/console/content", en: "Content & compliance", ar: "المحتوى والامتثال", icon: ScrollText },
  { to: "/console/inspector", en: "Audit trail", ar: "سجل التدقيق", icon: ShieldCheck },
  { to: "/console/ab", en: "Experiments", ar: "التجارب", icon: FlaskConical },
]

export default function ConsoleLayout() {
  const { L, lang, dir } = useAdmin()
  const hcp = useHcp()
  const demo = useDemoState()
  const sw = demo.data?.switches
  const status = sw?.engine_down
    ? { dot: "bg-rose-500", text: L("Fallback: editor lists", "الوضع الاحتياطي: قوائم المحررين") }
    : sw?.paused
      ? { dot: "bg-amber-500", text: L("Personalisation paused", "التخصيص متوقف مؤقتاً") }
      : { dot: "bg-emerald-500", text: L("Engine live", "المحرك يعمل") }

  return (
    <DirectionProvider dir={dir}>
      <div className="flex min-h-svh bg-[#f5f6fa] text-[#0d1330]" dir={dir} lang={lang}>
        <aside className="sticky top-0 flex h-svh w-64 shrink-0 flex-col border-e border-black/[0.06] bg-white">
          <Link to="/" className="flex items-center gap-3 px-5 py-5">
            <BrandMark className="size-9" />
            <div className="leading-tight">
              <div className="text-[15px] font-semibold tracking-tight">{L("Personalization", "محرك التخصيص")}</div>
              <div className="text-xs text-muted-foreground">{L("Admin dashboard", "لوحة الإدارة")}</div>
            </div>
          </Link>

          <nav className="flex-1 space-y-1 px-3 py-2">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                    isActive ? "bg-brand-50 text-brand-700" : "text-foreground/65 hover:bg-[#f5f6fa] hover:text-foreground",
                  )
                }
              >
                <n.icon className="size-[18px]" />
                {lang === "ar" ? n.ar : n.en}
              </NavLink>
            ))}
          </nav>

          <div className="space-y-3 border-t border-black/[0.06] p-4">
            <div className="flex items-center gap-2 rounded-xl bg-[#f5f6fa] px-3 py-2.5 text-xs font-medium">
              <span className="relative flex size-2"><span className={cn("absolute inline-flex size-full animate-ping rounded-full opacity-60", status.dot)} /><span className={cn("relative inline-flex size-2 rounded-full", status.dot)} /></span>
              {status.text}
            </div>
            <div className="px-1 text-xs">
              <div className="text-muted-foreground">{L("Viewing HCP", "الطبيب المعروض")}</div>
              <div className="mt-0.5 truncate font-medium">{hcp.data?.name ?? L("None selected", "لم يتم الاختيار")}</div>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-14 items-center justify-end gap-2 border-b border-black/[0.06] bg-white/85 px-8 backdrop-blur">
            <TopLink to="/site">{L("HCP portal", "بوابة الأطباء")}</TopLink>
            <TopLink to="/oce">{L("CRM rep view", "عرض المندوب في CRM")}</TopLink>
            <button
              onClick={() => adminLang.set(lang === "en" ? "ar" : "en")}
              className="ms-2 inline-flex h-9 items-center gap-1.5 rounded-full border border-black/10 bg-white px-3.5 text-sm font-medium transition hover:border-brand-300"
            >
              <Languages className="size-4" />
              {lang === "en" ? "العربية" : "English"}
            </button>
          </header>
          <main className="min-w-0 flex-1">
            <Outlet />
          </main>
        </div>
      </div>
    </DirectionProvider>
  )
}

function TopLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link to={to} className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm text-muted-foreground transition hover:bg-[#f5f6fa] hover:text-foreground">
      {children}
      <ExternalLink className="size-3.5 opacity-60" />
    </Link>
  )
}

export function PageHeader({ title, sub, right }: { title: string; sub?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 px-8 pb-2 pt-8">
      <div className="max-w-3xl">
        <h1 className="text-[26px] font-semibold tracking-tight">{title}</h1>
        {sub && <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{sub}</p>}
      </div>
      {right}
    </div>
  )
}

export function Panel({ title, sub, children, className, right, flush }: { title?: string; sub?: string; children: React.ReactNode; className?: string; right?: React.ReactNode; flush?: boolean }) {
  return (
    <section className={cn("rounded-2xl border border-black/[0.06] bg-white shadow-[0_1px_2px_rgba(13,19,48,0.04)]", className)}>
      {title && (
        <div className="flex items-start justify-between gap-3 px-6 pb-1 pt-5">
          <div>
            <h2 className="text-[15px] font-semibold">{title}</h2>
            {sub && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{sub}</p>}
          </div>
          {right}
        </div>
      )}
      <div className={flush ? "pt-3" : "p-6 pt-4"}>{children}</div>
    </section>
  )
}

export function Kpi({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white p-5 shadow-[0_1px_2px_rgba(13,19,48,0.04)]">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        {accent && <span className="size-2 rounded-full" style={{ background: accent }} />}
        {label}
      </div>
      <div className="num mt-2 text-[28px] font-semibold leading-none tracking-tight">{value}</div>
      {sub && <div className="mt-2 truncate text-xs text-muted-foreground">{sub}</div>}
    </div>
  )
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, React.ReactNode][] }) {
  return (
    <div className="inline-flex h-9 items-center rounded-full border border-black/10 bg-white p-1 text-xs font-medium">
      {options.map(([v, label]) => (
        <button key={v} type="button" onClick={() => onChange(v)} className={cn("h-full rounded-full px-3 transition", value === v ? "bg-brand-700 text-white" : "text-muted-foreground hover:text-foreground")}>
          {label}
        </button>
      ))}
    </div>
  )
}

export function AdminSelect({ value, onChange, children, className, label }: { value: string; onChange: (v: string) => void; children: React.ReactNode; className?: string; label?: string }) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn("h-9 rounded-full border border-black/10 bg-white px-3.5 text-sm outline-none transition hover:border-brand-300 focus-visible:ring-2 focus-visible:ring-ring", className)}
    >
      {children}
    </select>
  )
}
