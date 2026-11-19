import { useEffect, useState } from "react"
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router"
import { ChevronDown, Globe, LogOut, PanelRightClose, PanelRightOpen, ShieldCheck, UserRound, UserPlus } from "lucide-react"
import { SiteMark, TaDot } from "@/components/brand"
import { EngineLens } from "@/components/engine-lens"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ApiError } from "@/lib/api"
import { useConfig, useHcp, useHome } from "@/lib/hooks"
import { useT } from "@/lib/i18n"
import { session, useSession } from "@/lib/session"
import { cn } from "@/lib/utils"

const LENS_KEY = "hcp-demo-lens"

export default function SiteLayout() {
  const { t, lang, dir } = useT()
  const { hcpId } = useSession()
  const hcp = useHcp()
  const cfg = useConfig()
  const home = useHome()
  const nav = useNavigate()
  const loc = useLocation()
  const [lens, setLens] = useState(() => localStorage.getItem(LENS_KEY) !== "0")
  useEffect(() => {
    localStorage.setItem(LENS_KEY, lens ? "1" : "0")
  }, [lens])
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [loc.pathname])
  useEffect(() => {
    document.title = t("brand_name")
  }, [t])

  // stale identity (e.g. after a demo reset) → fall back to visitor mode
  useEffect(() => {
    if (hcpId && hcp.error instanceof ApiError && hcp.error.status === 404) session.setHcp(null)
  }, [hcpId, hcp.error])

  const tas = home.data?.therapy_areas ?? cfg?.therapy_areas.map((x, i) => ({ ta: x.id, name: x[lang], color: x.color, rank: i })) ?? []
  const spec = hcp.data && cfg ? cfg.specialties[hcp.data.specialty]?.[lang] : null

  return (
    <div dir={dir} lang={lang} className="min-h-svh bg-background">
      {/* utility bar */}
      <div className="border-b border-black/[0.05] bg-[#f5f6fa] text-foreground/70">
        <div className="mx-auto flex h-9 max-w-[1440px] items-center justify-between gap-4 px-5 text-[12px]">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="size-3.5" /> {t("footer").split(".")[0]}.
          </span>
          <button
            onClick={() => session.setLang(lang === "en" ? "ar" : "en")}
            className="flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-medium text-foreground hover:bg-white"
          >
            <Globe className="size-3.5" />
            {lang === "en" ? "العربية" : "English"}
          </button>
        </div>
      </div>

      <header className="sticky top-0 z-30 border-b border-black/[0.06] bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-6 px-5">
          <Link to="/site" className="flex items-center gap-2.5">
            <SiteMark />
            <div className="leading-tight">
              <div className="font-heading text-[18px] font-semibold tracking-tight text-[#0d1330]">{t("brand_name")}</div>
              <div className="hidden text-[11px] text-muted-foreground sm:block">{t("brand_tag")}</div>
            </div>
          </Link>


          <div className="ms-auto flex items-center gap-2">
            {hcp.data ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 rounded-full border bg-white py-1 ps-1 pe-3 text-sm hover:bg-muted">
                    <span className="grid size-7 place-items-center rounded-full bg-brand-700 text-xs font-semibold text-white">
                      {(hcp.data.name ?? "Dr").replace(/^Dr\.?\s*/, "").slice(0, 1)}
                    </span>
                    <span className="hidden max-w-[150px] truncate font-medium 2xl:inline">{hcp.data.name}</span>
                    <ChevronDown className="size-3.5 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel className="font-normal">
                    <div className="text-xs text-muted-foreground">{t("sign_in_as")}</div>
                    <div className="font-medium">{hcp.data.name}</div>
                    <div className="text-xs text-muted-foreground">{spec} · {cfg?.countries[hcp.data.country]?.[lang]}</div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => { session.setHcp(null); nav("/site") }}>
                    <LogOut className="size-4" /> {t("sign_out")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button asChild size="sm" className="rounded-full bg-brand-700 px-4 hover:bg-brand-800">
                <Link to="/site/register"><UserPlus className="size-4" />{t("register")}</Link>
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setLens((v) => !v)} className="hidden rounded-full lg:inline-flex" title={t("engine_lens")}>
              {lens ? <PanelRightClose className="size-4 rtl:rotate-180" /> : <PanelRightOpen className="size-4 rtl:rotate-180" />}
              <span className="hidden 2xl:inline">{t("engine_lens")}</span>
            </Button>
          </div>
        </div>
      </header>

      {/* All five therapy areas, always visible, in the HCP's personal order (§7.6: reorder, never hide) */}
      <div className="border-b border-black/[0.06] bg-white">
        <nav className="mx-auto flex max-w-[1440px] items-center gap-1 overflow-x-auto px-4 py-1.5 [scrollbar-width:thin]">
          <NavLink to="/site" end className={({ isActive }) => cn("whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition", isActive ? "bg-brand-50 text-brand-700" : "text-foreground/70 hover:text-brand-700")}>
            {t("nav_home")}
          </NavLink>
          <span className="mx-1 h-4 w-px shrink-0 bg-border" />
          {tas.map((ta) => (
            <NavLink
              key={ta.ta}
              to={`/site/ta/${ta.ta}`}
              className={({ isActive }) => cn("flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition", isActive ? "bg-brand-50 text-brand-700" : "text-foreground/75 hover:text-brand-700")}
            >
              <TaDot color={ta.color} />
              {ta.name}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className={cn("mx-auto grid max-w-[1440px]", lens ? "lg:grid-cols-[minmax(0,1fr)_380px]" : "grid-cols-1")}>
        <main className="min-w-0">
          {!hcpId && (
            <div className="border-b border-brand-100 bg-brand-50/60">
              <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-3 text-sm text-brand-800">
                <span className="flex items-center gap-2"><UserRound className="size-4" />{t("anon_banner")}</span>
                <Button asChild size="sm" variant="outline" className="rounded-full border-brand-300 bg-white">
                  <Link to="/site/register">{t("register")}</Link>
                </Button>
              </div>
            </div>
          )}
          <Outlet />
          <footer className="mt-20 border-t bg-white">
            <div className="mx-auto grid max-w-6xl gap-8 px-6 py-10 text-sm sm:grid-cols-[1.4fr_1fr_1fr]">
              <div>
                <div className="flex items-center gap-2.5">
                  <SiteMark className="size-7" />
                  <span className="font-heading text-base font-semibold text-[#0d1330]">{t("brand_name")}</span>
                </div>
                <p className="mt-3 max-w-sm text-muted-foreground">{t("brand_tag")}. {t("footer")}</p>
              </div>
              <ul className="space-y-2 text-muted-foreground">
                <li><Link className="hover:text-brand-700" to="/site/info/about">{t("nav_about")}</Link></li>
                <li><Link className="hover:text-brand-700" to="/site/info/contact">{t("nav_contact")}</Link></li>
                <li><Link className="font-medium text-brand-700 hover:underline" to="/site/info/side-effects">{t("nav_ae")}</Link></li>
              </ul>
              <ul className="space-y-2 text-muted-foreground">
                <li><Link className="hover:text-brand-700" to="/site/info/terms">{t("nav_terms")}</Link></li>
                <li><Link className="hover:text-brand-700" to="/site/info/privacy">{t("nav_privacy")}</Link></li>
              </ul>
            </div>
            <div className="border-t">
              <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-6 py-4 text-xs text-muted-foreground">
                <span>© 2026 {t("brand_name")}</span>
                <span>{t("footer")}</span>
              </div>
            </div>
          </footer>
        </main>
        {lens && (
          <div className="sticky top-16 hidden h-[calc(100svh-4rem)] border-s border-black/[0.06] lg:block">
            <EngineLens hcpId={hcpId} lang={lang} onClose={() => setLens(false)} />
          </div>
        )}
      </div>
    </div>
  )
}
