// Demo launcher: every scenario from the brief in a few clicks.
import { useState } from "react"
import { Link, useNavigate } from "react-router"
import { useMutation } from "@tanstack/react-query"
import { ArrowUpRight, Grid2x2, Network, Plug, RefreshCw, RotateCcw, ServerOff, ShieldAlert, UserPlus, UserRound, Users } from "lucide-react"
import { toast } from "sonner"
import { BrandMark } from "@/components/brand"
import { Switch } from "@/components/ui/switch"
import { api } from "@/lib/api"
import { useConfig, useDemoState, useHcp } from "@/lib/hooks"
import { session, useSession } from "@/lib/session"
import { queryClient } from "@/lib/track"
import { cn } from "@/lib/utils"

const SCENARIOS = [
  { n: 1, title: "First visit", body: "A new HCP with no history registers and lands on the right therapy area with sensible “start here” items.", icon: UserPlus, color: "#6b05e5", go: "register" },
  { n: 2, title: "Learning in action", body: "Read an article, watch a video. Recommendations change on the next page, each with a reason.", icon: RefreshCw, color: "#757ffa", go: "site" },
  { n: 3, title: "Therapy areas", body: "All five TAs ordered for the HCP. Read 4 items in another TA and the landing TA shifts.", icon: Grid2x2, color: "#fa5c00", go: "ta" },
  { n: 4, title: "HCP clusters", body: "Similar HCPs grouped and labelled automatically; the live HCP joins a cluster after 5 actions.", icon: Network, color: "#002399", ring: true, go: "clusters" },
  { n: 5, title: "IQVIA OCE", body: "A rep screen shows each HCP’s engagement and recommended content as it arrives in the CRM.", icon: Plug, color: "#6107f5", go: "oce" },
] as const

export default function Launcher() {
  const nav = useNavigate()
  const { hcpId, anonCountry } = useSession()
  const hcp = useHcp()
  const cfg = useConfig()
  const demo = useDemoState()
  const [armReset, setArmReset] = useState(false)

  const sw = useMutation({
    mutationFn: api.switches,
    onSuccess: () => {
      queryClient.invalidateQueries()
    },
  })
  const reset = useMutation({
    mutationFn: api.reset,
    onSuccess: (r) => {
      session.setHcp(null)
      queryClient.invalidateQueries()
      setArmReset(false)
      toast.success(`Demo reset — now ${r.new_run}`, { description: `Removed ${r.deleted.events} events, ${r.deleted.impressions} impressions, ${r.deleted.hcps} live HCPs. Seeded data untouched.` })
    },
  })

  const go = (k: string) => {
    if (k === "register") {
      session.setHcp(null)
      nav("/site/register")
    } else if (k === "site") nav("/site")
    else if (k === "ta") nav("/site/ta/cardiometabolic")
    else if (k === "clusters") nav("/console/clusters")
    else if (k === "oce") nav(hcpId ? `/oce?account=${hcpId}` : "/oce")
  }

  const sws = demo.data?.switches

  return (
    <div className="min-h-svh bg-brand-700 text-white" dir="ltr" lang="en">
      <div className="mx-auto max-w-[1280px] px-8 py-8">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BrandMark inverted className="size-10" />
            <div>
              <div className="eyebrow text-white/60">AI Personalization Engine</div>
              <div className="text-lg font-semibold">Live demo</div>
            </div>
          </div>
          <nav className="flex items-center gap-1 text-sm">
            <TopLink to="/site">HCP site</TopLink>
            <TopLink to="/console">Engine console</TopLink>
            <TopLink to="/oce">Mock OCE</TopLink>
          </nav>
        </header>

        <section className="mt-12">
          <div className="eyebrow text-white/70">Demo scenarios</div>
          <h1 className="mt-3 max-w-3xl text-[36px] font-light leading-tight">
            Five scenarios, run live on one HCP account.
          </h1>

          <div className="relative mt-14 grid grid-cols-5 gap-6">
            <div className="absolute inset-x-[10%] top-[58px] h-px bg-white/30" />
            {SCENARIOS.map((s) => (
              <button key={s.n} onClick={() => go(s.go)} className="group relative flex flex-col items-center text-center">
                <span className="mb-4 text-[15px] font-semibold">{s.title}</span>
                <span
                  className={cn("hex-v grid size-[104px] place-items-center transition-transform duration-300 group-hover:scale-105", "ring-0")}
                  style={{ background: "ring" in s ? "transparent" : s.color }}
                >
                  <s.icon className="size-9" strokeWidth={1.75} />
                </span>
                <span className="mt-4 text-[13px] leading-relaxed text-white/75">{s.body}</span>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-white/60 transition group-hover:text-white">
                  Open <ArrowUpRight className="size-3.5" />
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="mt-14 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          {/* personas */}
          <div className="rounded-2xl bg-white p-6 text-foreground">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-semibold"><Users className="size-4 text-brand-700" />Who is browsing</h2>
              <span className="text-xs text-muted-foreground">Current: {hcp.data?.name ?? (hcpId ? hcpId : `Visitor (${anonCountry})`)}</span>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <button
                onClick={() => {
                  session.setHcp(null)
                  nav("/site/register")
                }}
                className="flex items-center gap-3 rounded-xl border-2 border-dashed border-brand-300 p-3 text-start transition hover:border-brand-600 hover:bg-brand-50"
              >
                <span className="grid size-10 place-items-center rounded-lg bg-ember-500 text-white"><UserPlus className="size-5" /></span>
                <span>
                  <span className="block text-sm font-semibold">Register a new HCP live</span>
                  <span className="block text-xs text-muted-foreground">Scenario 1 starts here</span>
                </span>
              </button>
              {demo.data?.personas.map((p) => (
                <button
                  key={p.hcp_id}
                  onClick={() => {
                    session.setHcp(p.hcp_id, p.language)
                    queryClient.invalidateQueries()
                    nav("/site")
                  }}
                  className={cn("flex items-center gap-3 rounded-xl border p-3 text-start transition hover:border-brand-400 hover:bg-brand-50", hcpId === p.hcp_id && "border-brand-600 bg-brand-50")}
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-700 text-sm font-semibold text-white">
                    {p.name.replace(/^Dr\.?\s*/, "").slice(0, 1)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{p.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {p.label} · {cfg?.specialties[p.specialty]?.en} · {p.country} · {p.language.toUpperCase()}
                    </span>
                    <span className="mt-1 flex flex-wrap gap-1">
                      {!p.verified && <Tag tone="amber">Unverified</Tag>}
                      {!p.crm_consent && <Tag tone="rose">No CRM consent</Tag>}
                      {!p.tracking_consent && <Tag tone="rose">No tracking</Tag>}
                    </span>
                  </span>
                </button>
              ))}
              <div className="flex items-center gap-3 rounded-xl border p-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground"><UserRound className="size-5" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">Anonymous visitor</span>
                  <span className="block text-xs text-muted-foreground">Public, non-promotional only · no tracking</span>
                </span>
                <select
                  value={anonCountry}
                  onChange={(e) => session.setAnonCountry(e.target.value)}
                  className="h-8 rounded-md border bg-white px-1.5 text-xs"
                >
                  {cfg && Object.keys(cfg.countries).map((c) => <option key={c}>{c}</option>)}
                </select>
                <button onClick={() => { session.setHcp(null); nav("/site") }} className="rounded-md bg-brand-700 px-2.5 py-1.5 text-xs font-medium text-white">Go</button>
              </div>
            </div>
          </div>

          {/* controls */}
          <div className="flex flex-col gap-4 rounded-2xl bg-white/[0.07] p-6 ring-1 ring-white/15">
            <h2 className="font-semibold">Stage controls</h2>
            <Control
              icon={ServerOff}
              title="Engine down"
              body="Simulate the AI service failing. The site keeps working on editor-curated lists."
              checked={!!sws?.engine_down}
              onChange={(v) => sw.mutate({ engine_down: v })}
            />
            <Control
              icon={ShieldAlert}
              title="Pause personalisation"
              body="Admin override: fall back to editor-curated lists for everyone."
              checked={!!sws?.paused}
              onChange={(v) => sw.mutate({ paused: v })}
            />
            <div className="mt-auto rounded-xl bg-white/[0.06] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold"><RotateCcw className="size-4" />Reset demo</div>
                  <p className="mt-0.5 text-xs text-white/60">Deletes only rows from <span className="font-mono">{demo.data?.demo_run}</span>. Seeded data untouched.</p>
                </div>
                <button
                  onClick={() => (armReset ? reset.mutate() : setArmReset(true))}
                  onBlur={() => setArmReset(false)}
                  disabled={reset.isPending}
                  className={cn("shrink-0 rounded-lg px-3 py-2 text-sm font-semibold transition", armReset ? "bg-ember-500 text-white" : "bg-white text-brand-700 hover:bg-brand-50")}
                >
                  {reset.isPending ? "Resetting…" : armReset ? "Confirm reset" : "Reset"}
                </button>
              </div>
            </div>
          </div>
        </section>

        <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 text-xs text-white/50">
          <span>Engine logic runs live on sample data · {cfg?.model_version} · {cfg?.embedding} · {cfg?.clustering}</span>
          <span>Hashed System</span>
        </footer>
      </div>
    </div>
  )
}

function TopLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link to={to} className="rounded-md px-3 py-2 text-white/80 transition hover:bg-white/10 hover:text-white">
      {children}
    </Link>
  )
}

function Tag({ tone, children }: { tone: "amber" | "rose"; children: React.ReactNode }) {
  return <span className={cn("rounded px-1.5 py-px text-[10px] font-medium", tone === "amber" ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-800")}>{children}</span>
}

function Control({ icon: Icon, title, body, checked, onChange }: { icon: React.ElementType; title: string; body: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={cn("flex cursor-pointer items-start justify-between gap-4 rounded-xl p-4 transition", checked ? "bg-ember-500/20 ring-1 ring-ember-500/50" : "bg-white/[0.06]")}>
      <span>
        <span className="flex items-center gap-2 text-sm font-semibold"><Icon className="size-4" />{title}</span>
        <span className="mt-0.5 block text-xs text-white/60">{body}</span>
      </span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  )
}
