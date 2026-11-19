// Landing page: what the engine does, live proof from the running engine, then the guided demo.
import { useState } from "react"
import { Link, useNavigate } from "react-router"
import { useMutation, useQuery } from "@tanstack/react-query"
import {
  ArrowRight, BadgeCheck, ChevronDown, Grid2x2, Layers, Lock, MessageSquareText, Network, Play, Plug, RefreshCw,
  RotateCcw, ServerOff, ShieldAlert, ShieldCheck, Sparkles, UserPlus, UserRound, UsersRound,
} from "lucide-react"
import { toast } from "sonner"
import { BrandMark, LEVEL_META } from "@/components/brand"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Switch } from "@/components/ui/switch"
import { api, type Level } from "@/lib/api"
import { useConfig, useDemoState } from "@/lib/hooks"
import { session, useSession } from "@/lib/session"
import { queryClient } from "@/lib/track"
import { cn } from "@/lib/utils"

// The hero shows the engine's real output for the long-history persona.
const SHOWCASE_HCP = "hcp_demo_cardio"

const LEVELS: { level: Level; title: string; body: string; icon: React.ElementType }[] = [
  { level: "L1", title: "Therapy area", body: "Orders all five therapy areas for each HCP from specialty and recent reading, with time decay so interests can shift.", icon: Layers },
  { level: "L2", title: "Individual behaviour", body: "Scores every eligible item on each visit from what this HCP read, watched and skipped, using bilingual content embeddings.", icon: Sparkles },
  { level: "L3", title: "Peer clusters", body: "Finds groups of HCPs who behave alike and surfaces what their peers found useful, so new users are never a blank slate.", icon: UsersRound },
]

const GUARDRAILS = [
  { icon: ShieldCheck, title: "Compliant by design", body: "Market rules, expiry, promotional and gated content filtered before ranking." },
  { icon: MessageSquareText, title: "Every pick explained", body: "Each recommendation carries a plain-language reason from its strongest signal." },
  { icon: Lock, title: "Consent first", body: "Personalisation and CRM sharing are separate opt-ins, enforced in the engine." },
  { icon: Plug, title: "CRM-ready", body: "Engagement and next-best content flow to IQVIA OCE for the field team." },
]

const JOURNEY = [
  { title: "First visit", body: "A new HCP registers and lands in the right therapy area with curated starting points.", icon: UserPlus, go: "register" },
  { title: "Learning in action", body: "Read an article, watch a video, and see the next page re-rank with reasons.", icon: RefreshCw, go: "site" },
  { title: "Shifting interests", body: "Read in another therapy area and watch the landing area move after five items.", icon: Grid2x2, go: "ta" },
  { title: "Peer clusters", body: "Similar HCPs grouped and labelled automatically; the live HCP joins after five actions.", icon: Network, go: "clusters" },
  { title: "Field team view", body: "The rep's CRM screen shows engagement and recommended content as it arrives.", icon: Plug, go: "oce" },
] as const

export default function Launcher() {
  const nav = useNavigate()
  const { hcpId } = useSession()

  const go = (k: string) => {
    if (k === "register") {
      session.setHcp(null)
      nav("/site/register")
    } else if (k === "site") nav("/site")
    else if (k === "ta") nav("/site/ta/cardiometabolic")
    else if (k === "clusters") nav("/console/clusters")
    else if (k === "oce") nav(hcpId ? `/oce?account=${hcpId}` : "/oce")
  }

  return (
    <div className="min-h-svh bg-[#f7f8fc] text-foreground" dir="ltr" lang="en">
      <TopBar onStart={() => go("register")} />
      <Hero onStart={() => go("register")} />
      <HowItWorks />
      <Journey go={go} />
      <Personas />
      <Presenter />
      <footer className="border-t bg-white">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 px-6 py-6 text-xs text-muted-foreground">
          <span className="flex items-center gap-2"><BrandMark className="size-5" />AI Personalization Engine · Hashed System</span>
          <span>Live engine on sample HCPs and content</span>
        </div>
      </footer>
    </div>
  )
}

function TopBar({ onStart }: { onStart: () => void }) {
  return (
    <header className="sticky top-0 z-30 border-b border-black/[0.06] bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-4 px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <BrandMark className="size-8" />
          <span className="text-[15px] font-semibold tracking-tight">Personalization Engine</span>
        </Link>
        <nav className="hidden items-center gap-1 text-sm text-muted-foreground md:flex">
          <NavLink to="/site">HCP portal</NavLink>
          <NavLink to="/console">Admin dashboard</NavLink>
          <NavLink to="/oce">CRM rep view</NavLink>
        </nav>
        <button onClick={onStart} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-brand-700 px-4 text-sm font-medium text-white transition hover:bg-brand-800">
          Start demo <ArrowRight className="size-4" />
        </button>
      </div>
    </header>
  )
}

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  return <Link to={to} className="rounded-full px-3 py-1.5 transition hover:bg-brand-50 hover:text-brand-700">{children}</Link>
}

function Hero({ onStart }: { onStart: () => void }) {
  const stats = useQuery({ queryKey: ["landing-analytics"], queryFn: api.analytics, staleTime: 60_000 })
  const k = stats.data?.kpis
  const sw = useDemoState().data?.switches
  const fallback = !!(sw?.engine_down || sw?.paused)
  const fmt = (n: number) => n.toLocaleString("en-US")

  return (
    <section className="relative overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_80%_10%,#e5e7fc_0%,transparent_70%),radial-gradient(40%_40%_at_5%_90%,#fff3eb_0%,transparent_70%)]" />
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:radial-gradient(#c9cef8_1px,transparent_1px)] [background-size:22px_22px] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />

      <div className="relative mx-auto grid max-w-[1200px] items-center gap-14 px-6 pb-20 pt-16 lg:grid-cols-[1.05fr_1fr] lg:pt-20">
        <div>
          {fallback ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 shadow-sm">
              <span className="size-2 rounded-full bg-amber-500" />
              {sw?.engine_down ? "Engine offline: editor-curated lists are being served" : "Personalisation paused: editor-curated lists are being served"}
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white px-3 py-1 text-xs font-medium text-brand-700 shadow-sm">
              <span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex size-2 rounded-full bg-emerald-500" /></span>
              Engine running live
            </span>
          )}
          <h1 className="mt-6 font-heading text-[44px] font-semibold leading-[1.08] tracking-tight text-[#0d1330] sm:text-[56px]">
            Every doctor sees the content that <span className="text-brand-600">matters to them.</span>
          </h1>
          <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-muted-foreground">
            An AI engine that learns from what each healthcare professional reads and watches, then reorders your approved
            content within your market and compliance rules, and passes every signal to the field team's CRM.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button onClick={onStart} className="inline-flex h-12 items-center gap-2 rounded-full bg-brand-700 px-6 text-[15px] font-medium text-white shadow-lg shadow-brand-700/20 transition hover:bg-brand-800">
              <Play className="size-4 fill-current" /> Start the live demo
            </button>
            <Link to="/console" className="inline-flex h-12 items-center gap-2 rounded-full border border-black/10 bg-white px-6 text-[15px] font-medium transition hover:border-brand-300 hover:text-brand-700">
              See the engine at work <ArrowRight className="size-4" />
            </Link>
          </div>

          <dl className="mt-12 grid max-w-xl grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4">
            <Stat value={k ? fmt(k.active_hcps) : "–"} label="Active HCPs, last 30 days" />
            <Stat value={k ? fmt(k.impressions) : "–"} label="Recommendations served" />
            <Stat value={k ? `${(k.ctr * 100).toFixed(1)}%` : "–"} label="Click-through" />
            <Stat value={k ? `${Math.round(k.catalogue_coverage * 100)}%` : "–"} label="Catalogue reached" />
          </dl>
        </div>

        <HeroPreview />
      </div>
    </section>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <dt className="sr-only">{label}</dt>
      <dd className="num text-2xl font-semibold tracking-tight text-[#0d1330]">{value === "–" ? <span className="inline-block h-7 w-16 animate-pulse rounded-md bg-brand-100/70 align-middle" /> : value}</dd>
      <dd className="mt-0.5 text-xs text-muted-foreground">{label}</dd>
    </div>
  )
}

// Real output of the engine for one prepared HCP, framed as their portal.
function HeroPreview() {
  const home = useQuery({
    queryKey: ["landing-preview"],
    queryFn: () => api.home({ hcp_id: SHOWCASE_HCP, lang: "en", session_id: "landing-preview" }),
    staleTime: Infinity,
    retry: false,
  })
  const cfg = useConfig()
  const d = home.data
  const recs = d?.rows.find((r) => r.slot === "home_recommended")?.items ?? []
  const peers = d?.rows.find((r) => r.slot === "peers")?.items ?? []
  const picks = [...recs.slice(0, 2), ...peers.slice(0, 1)]
  const tas = (d?.therapy_areas ?? []).filter((t) => t.share > 0).slice(0, 3)

  return (
    <div className="relative">
      <div className="relative rounded-2xl border border-black/[0.07] bg-white shadow-[0_30px_80px_-20px_rgba(0,35,153,0.25)]">
        <div className="flex items-center gap-1.5 border-b px-4 py-3">
          <span className="size-2.5 rounded-full bg-[#ff5f57]" /><span className="size-2.5 rounded-full bg-[#febc2e]" /><span className="size-2.5 rounded-full bg-[#28c840]" />
          <span className="ms-3 truncate rounded-md bg-muted px-3 py-1 text-[11px] text-muted-foreground">hcp-portal / for-you</span>
        </div>
        <div className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-full bg-brand-700 text-sm font-semibold text-white">KA</span>
              <div>
                <div className="text-sm font-semibold">Dr. Khalid Al-Mansouri</div>
                <div className="text-xs text-muted-foreground">{cfg?.specialties.cardiologist?.en ?? "Cardiologist"} · Recommended for you</div>
              </div>
            </div>
            {d && <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">{Math.round(d.alpha * 100)}% personalised</span>}
          </div>

          {tas.length > 0 && (
            <div className="mt-5 rounded-xl bg-[#f7f8fc] p-3.5">
              <div className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Therapy-area interest</div>
              <div className="mt-2.5 grid grid-cols-3 gap-3">
                {tas.map((t) => (
                  <div key={t.ta} className="min-w-0">
                    <div className="flex justify-between gap-1 text-[11.5px]"><span className="truncate font-medium">{t.name}</span><span className="num text-muted-foreground">{Math.round(t.share * 100)}%</span></div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full" style={{ width: `${t.share * 100}%`, background: t.color }} /></div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 space-y-3">
            {home.isLoading && [0, 1, 2].map((i) => <div key={i} className="h-[76px] animate-pulse rounded-xl bg-muted" />)}
            {home.isError && <div className="rounded-xl bg-muted p-6 text-center text-sm text-muted-foreground">Start the engine to see live recommendations.</div>}
            {picks.map((r) => (
              <div key={r.item_id} className="flex items-center gap-3 rounded-xl border border-black/[0.06] p-2.5">
                <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
                  {r.item.media?.poster && <img src={r.item.media.poster} alt="" className="size-full object-cover" />}
                  {r.item.type === "video" && <span className="absolute inset-0 grid place-items-center bg-black/20"><Play className="size-4 fill-white text-white" /></span>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold">{r.item.title}</div>
                  <div className="mt-1 flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                    <span className={cn("size-1.5 shrink-0 rounded-full", LEVEL_META[r.level].dot)} />
                    <span className="truncate">{r.reason.text}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {d?.cluster && (
        <div className="absolute -right-4 -top-6 hidden max-w-[230px] rounded-xl border border-black/[0.07] bg-white px-4 py-3 shadow-xl sm:block">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-level-l3"><UsersRound className="size-3.5" />Peer cluster</div>
          <div className="mt-1 text-xs font-medium leading-snug">{d.cluster.label_en}</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">{d.cluster.size} similar HCPs</div>
        </div>
      )}
    </div>
  )
}

function SectionHead({ eyebrow, title, body }: { eyebrow: string; title: string; body?: string }) {
  return (
    <div className="max-w-2xl">
      <div className="eyebrow text-brand-600">{eyebrow}</div>
      <h2 className="mt-3 font-heading text-[34px] font-semibold leading-tight tracking-tight text-[#0d1330]">{title}</h2>
      {body && <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{body}</p>}
    </div>
  )
}

function HowItWorks() {
  return (
    <section className="border-y border-black/[0.06] bg-white">
      <div className="mx-auto max-w-[1200px] px-6 py-20">
        <SectionHead
          eyebrow="How it works"
          title="Three levels of personalisation, one ranked feed."
          body="New HCPs start with editor picks and specialty favourites. With every action, the engine shifts weight to their own behaviour, fully personal after five interactions."
        />
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {LEVELS.map(({ level, title, body, icon: Icon }, i) => (
            <div key={level} className="group relative rounded-2xl border border-black/[0.07] bg-[#fbfbfd] p-6 transition hover:-translate-y-0.5 hover:shadow-lg">
              <div className="flex items-center justify-between">
                <span className={cn("grid size-11 place-items-center rounded-xl ring-1 ring-inset", LEVEL_META[level].className)}><Icon className="size-5" /></span>
                <span className="num text-xs font-medium text-muted-foreground">Level {i + 1}</span>
              </div>
              <h3 className="mt-5 text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-px overflow-hidden rounded-2xl border border-black/[0.07] bg-black/[0.07] sm:grid-cols-2 lg:grid-cols-4">
          {GUARDRAILS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="bg-white p-5">
              <Icon className="size-5 text-brand-600" />
              <div className="mt-3 text-sm font-semibold">{title}</div>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Journey({ go }: { go: (k: string) => void }) {
  return (
    <section className="mx-auto max-w-[1200px] px-6 py-20">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <SectionHead eyebrow="Live demo" title="Follow one doctor from first visit to the field team." />
        <button onClick={() => go("register")} className="inline-flex h-11 items-center gap-2 rounded-full bg-brand-700 px-5 text-sm font-medium text-white transition hover:bg-brand-800">
          Begin at step 1 <ArrowRight className="size-4" />
        </button>
      </div>
      <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {JOURNEY.map((s, i) => (
          <li key={s.title}>
            <button onClick={() => go(s.go)} className="group flex h-full w-full flex-col rounded-2xl border border-black/[0.07] bg-white p-5 text-start transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lg">
              <div className="flex items-center justify-between">
                <span className="num grid size-8 place-items-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700 ring-1 ring-brand-100">{i + 1}</span>
                <s.icon className="size-5 text-muted-foreground transition group-hover:text-brand-600" />
              </div>
              <h3 className="mt-5 font-semibold">{s.title}</h3>
              <p className="mt-1.5 flex-1 text-[13px] leading-relaxed text-muted-foreground">{s.body}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-[13px] font-medium text-brand-700">
                Open <ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" />
              </span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  )
}

function Personas() {
  const nav = useNavigate()
  const { hcpId, anonCountry } = useSession()
  const cfg = useConfig()
  const demo = useDemoState()

  return (
    <section className="border-t border-black/[0.06] bg-white">
      <div className="mx-auto max-w-[1200px] px-6 py-20">
        <SectionHead
          eyebrow="Try it yourself"
          title="Browse as a different HCP."
          body="Each profile shows a different rule at work: long reading history, unverified access, missing CRM consent or an anonymous visitor."
        />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <button
            onClick={() => { session.setHcp(null); nav("/site/register") }}
            className="flex items-center gap-4 rounded-2xl border-2 border-dashed border-brand-200 p-5 text-start transition hover:border-brand-500 hover:bg-brand-50/50"
          >
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-ember-500 text-white"><UserPlus className="size-5" /></span>
            <span>
              <span className="block font-semibold">Register a new HCP</span>
              <span className="block text-[13px] text-muted-foreground">Start from zero history</span>
            </span>
          </button>
          {demo.data?.personas.map((p) => {
            const initials = p.name.replace(/^Dr\.?\s*/, "").split(/\s+/).map((w) => w[0]).join("").slice(0, 2)
            return (
              <button
                key={p.hcp_id}
                onClick={() => { session.setHcp(p.hcp_id, p.language); queryClient.invalidateQueries(); nav("/site") }}
                className={cn("flex items-center gap-4 rounded-2xl border p-5 text-start transition hover:border-brand-300 hover:shadow-md", hcpId === p.hcp_id && "border-brand-500 ring-2 ring-brand-100")}
              >
                <span className="grid size-12 shrink-0 place-items-center rounded-full bg-brand-700 text-sm font-semibold text-white">{initials}</span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 font-semibold">
                    <span className="truncate">{p.name}</span>
                    {p.verified && <BadgeCheck className="size-4 shrink-0 text-brand-600" />}
                  </span>
                  <span className="block truncate text-[13px] text-muted-foreground">
                    {cfg?.specialties[p.specialty]?.en} · {cfg?.countries[p.country]?.en ?? p.country} · {p.language === "ar" ? "Arabic" : "English"}
                  </span>
                  <span className="mt-1.5 block text-xs font-medium text-brand-700">{p.label}</span>
                </span>
              </button>
            )
          })}
          <div className="flex items-center gap-4 rounded-2xl border p-5 lg:col-span-2">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground"><UserRound className="size-5" /></span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">Anonymous visitor</span>
              <span className="block text-[13px] text-muted-foreground">Public content only, no tracking</span>
            </span>
            <select
              value={anonCountry}
              onChange={(e) => session.setAnonCountry(e.target.value)}
              aria-label="Visitor market"
              className="h-9 rounded-lg border bg-white px-2 text-xs"
            >
              {cfg && Object.keys(cfg.countries).map((c) => <option key={c} value={c}>{cfg.countries[c].en}</option>)}
            </select>
            <button onClick={() => { session.setHcp(null); nav("/site") }} className="h-9 rounded-lg bg-brand-700 px-3 text-xs font-medium text-white">Go</button>
          </div>
        </div>
      </div>
    </section>
  )
}

// Presenter-only tools stay out of the way until opened.
function Presenter() {
  const demo = useDemoState()
  const [open, setOpen] = useState(false)
  const [armReset, setArmReset] = useState(false)
  const sws = demo.data?.switches

  const sw = useMutation({ mutationFn: api.switches, onSuccess: () => queryClient.invalidateQueries() })
  const reset = useMutation({
    mutationFn: api.reset,
    onSuccess: (r) => {
      session.setHcp(null)
      queryClient.invalidateQueries()
      setArmReset(false)
      toast.success(`Demo reset — now ${r.new_run}`, { description: `Removed ${r.deleted.events} events, ${r.deleted.impressions} impressions, ${r.deleted.hcps} live HCPs. Seeded data untouched.` })
    },
  })
  const active = !!sws?.engine_down || !!sws?.paused

  return (
    <section className="mx-auto max-w-[1200px] px-6 py-10">
      <Collapsible open={open} onOpenChange={setOpen} className="rounded-2xl border border-black/[0.07] bg-white">
        <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 px-5 py-4 text-start">
          <span className="flex items-center gap-2 text-sm font-medium">
            Presenter tools
            {active && <span className="rounded-full bg-ember-50 px-2 py-0.5 text-[11px] font-medium text-ember-600">Override active</span>}
          </span>
          <ChevronDown className={cn("size-4 text-muted-foreground transition", open && "rotate-180")} />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="grid gap-3 border-t p-5 md:grid-cols-3">
            <Control icon={ServerOff} title="Simulate engine outage" body="The site keeps working on editor-curated lists." checked={!!sws?.engine_down} onChange={(v) => sw.mutate({ engine_down: v })} />
            <Control icon={ShieldAlert} title="Pause personalisation" body="Admin override: editor lists for everyone." checked={!!sws?.paused} onChange={(v) => sw.mutate({ paused: v })} />
            <div className="flex items-start justify-between gap-4 rounded-xl bg-muted/60 p-4">
              <span>
                <span className="flex items-center gap-2 text-sm font-semibold"><RotateCcw className="size-4" />Reset demo</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">Clears this session's activity. Sample data stays.</span>
              </span>
              <button
                onClick={() => (armReset ? reset.mutate() : setArmReset(true))}
                onBlur={() => setArmReset(false)}
                disabled={reset.isPending}
                className={cn("shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition", armReset ? "bg-ember-500 text-white" : "bg-white text-brand-700 ring-1 ring-black/10 hover:bg-brand-50")}
              >
                {reset.isPending ? "Resetting…" : armReset ? "Confirm" : "Reset"}
              </button>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </section>
  )
}

function Control({ icon: Icon, title, body, checked, onChange }: { icon: React.ElementType; title: string; body: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={cn("flex cursor-pointer items-start justify-between gap-4 rounded-xl p-4 transition", checked ? "bg-ember-50 ring-1 ring-ember-500/40" : "bg-muted/60")}>
      <span>
        <span className="flex items-center gap-2 text-sm font-semibold"><Icon className="size-4" />{title}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{body}</span>
      </span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  )
}
