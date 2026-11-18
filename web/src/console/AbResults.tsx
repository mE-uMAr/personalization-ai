import { useQuery } from "@tanstack/react-query"
import { AlertTriangle, FlaskConical, Hash, Trophy } from "lucide-react"
import { api } from "@/lib/api"
import { PageHeader, Panel } from "./ConsoleLayout"

const pct = (v: number, d = 2) => `${(v * 100).toFixed(d)}%`

export default function AbResults() {
  const q = useQuery({ queryKey: ["ab"], queryFn: api.ab })
  const d = q.data
  const a = d?.arms.find((x) => x.variant === "A")
  const b = d?.arms.find((x) => x.variant === "B")
  const maxCtr = Math.max(a?.ctr ?? 0, b?.ctr ?? 0) || 1
  return (
    <div>
      <PageHeader title="A/B results" sub="Example results screen. Live A/B experiments run in the full build; the statistics below are computed from the impression log." />
      {d && a && b && (
        <div className="space-y-6 p-8">
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div>
              <b>Example with simulated traffic.</b> Sticky assignment, impression logging and the statistics are the production code paths.
              Live results come from the 6-week baseline agreed with the client.
            </div>
          </div>
          <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
            <Panel title={d.experiment_id} sub={`Slot: home · recommended  ·  Metric: ${d.metric}  ·  Split 50/50, sticky per HCP`} right={<FlaskConical className="size-4 text-muted-foreground" />}>
              <div className="space-y-5">
                {[a, b].map((arm) => (
                  <div key={arm.variant}>
                    <div className="mb-1.5 flex items-baseline justify-between gap-3">
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <span className="grid size-6 place-items-center rounded-md bg-muted text-xs font-bold">{arm.variant}</span>
                        {arm.label}
                        {arm.variant === "B" && (d.lift ?? 0) > 0 && (d.lift_ci?.[0] ?? 0) > 0 && <Trophy className="size-4 text-ember-500" />}
                      </span>
                      <span className="text-2xl font-semibold num">{pct(arm.ctr)}</span>
                    </div>
                    <div className="h-3 rounded-full bg-muted">
                      <div className="h-full rounded-full" style={{ width: `${(arm.ctr / maxCtr) * 100}%`, background: arm.variant === "B" ? "#002399" : "#8a8f9f" }} />
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground num">{arm.clicks.toLocaleString()} clicks · {arm.impressions.toLocaleString()} impressions · {arm.hcps} HCPs</div>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel title="Result">
              <div className="text-sm">
                <div className="text-xs text-muted-foreground">Relative lift in CTR (B vs A)</div>
                <div className="mt-1 text-4xl font-semibold text-brand-700 num">+{pct(d.lift ?? 0, 1)}</div>
                <div className="mt-1 text-xs text-muted-foreground num">95% CI {pct(d.lift_ci?.[0] ?? 0, 1)} to {pct(d.lift_ci?.[1] ?? 0, 1)} · z = {d.z} · p = {d.p_value}</div>
                {/* CI strip */}
                <div className="relative mt-5 h-8">
                  <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
                  {(() => {
                    const lo = d.lift_ci?.[0] ?? 0, hi = d.lift_ci?.[1] ?? 0, span = Math.max(Math.abs(lo), Math.abs(hi)) * 1.3 || 1
                    const x = (v: number) => `${50 + (v / span) * 50}%`
                    return (
                      <>
                        <div className="absolute top-1/2 h-4 w-px -translate-y-1/2 bg-foreground/40" style={{ left: "50%" }} />
                        <div className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-brand-300" style={{ left: x(lo), right: `calc(100% - ${x(hi)})` }} />
                        <div className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-700 ring-2 ring-white" style={{ left: x(d.lift ?? 0) }} />
                        <span className="absolute -bottom-1 text-[10px] text-muted-foreground" style={{ left: "50%", transform: "translateX(-50%)" }}>0</span>
                      </>
                    )
                  })()}
                </div>
                {d.small_sample && <p className="mt-4 flex items-center gap-1.5 text-xs text-amber-700"><AlertTriangle className="size-3.5" />Sample is small — treat the result with caution.</p>}
                <button className="mt-6 w-full rounded-lg bg-brand-700 py-2.5 text-sm font-semibold text-white opacity-60" disabled title="Available in the full build">
                  Roll out B to 100%
                </button>
              </div>
            </Panel>
          </div>
          <Panel title="How the platform runs experiments">
            <ul className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
              <Li icon={Hash} t="Sticky assignment" d="hash(HCP ID + experiment ID) — same arm across sessions and devices" />
              <Li icon={FlaskConical} t="Variants" d="Ranking model, blend weights, layout or number of items, per slot" />
              <Li icon={AlertTriangle} t="Rules never relax" d="No variant can bypass the eligibility filter" />
              <Li icon={Trophy} t="Every impression records its variant" d="Results can always be recomputed from the log" />
            </ul>
          </Panel>
        </div>
      )}
    </div>
  )
}

function Li({ icon: Icon, t, d }: { icon: React.ElementType; t: string; d: string }) {
  return (
    <li className="rounded-lg border p-3">
      <div className="flex items-center gap-2 font-medium"><Icon className="size-4 text-brand-600" />{t}</div>
      <div className="mt-1 text-xs text-muted-foreground">{d}</div>
    </li>
  )
}
