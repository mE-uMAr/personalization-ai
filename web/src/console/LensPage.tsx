import { Link } from "react-router"
import { ExternalLink } from "lucide-react"
import { EngineLens } from "@/components/engine-lens"
import { Button } from "@/components/ui/button"
import { useConfig } from "@/lib/hooks"
import { useSession } from "@/lib/session"
import { HcpPicker } from "./HcpPicker"
import { PageHeader, Panel } from "./ConsoleLayout"

export default function LensPage() {
  const { hcpId } = useSession()
  const cfg = useConfig()
  const e = cfg?.engine
  return (
    <div>
      <PageHeader
        title="Engine lens"
        sub="Live view of one HCP: events, therapy-area affinity, cold→warm blend, cluster and the last score breakdown."
        right={
          <div className="flex items-center gap-2">
            <HcpPicker />
            <Button asChild variant="outline" size="sm"><Link to="/site"><ExternalLink className="size-4" />Open site</Link></Button>
          </div>
        }
      />
      <div className="grid gap-6 p-8 xl:grid-cols-[440px_1fr]">
        <div className="h-[calc(100svh-150px)] overflow-hidden rounded-xl shadow-sm">
          <EngineLens hcpId={hcpId} />
        </div>
        <div className="space-y-6">
          <Panel title="How the score is built" sub="One transparent formula. The largest weighted part picks the reason template.">
            <div className="space-y-4 text-sm">
              <Formula
                label="Cold start"
                parts={Object.entries(e?.cold_weights ?? {}).map(([k, v]) => [k, v])}
                labels={cfg?.component_labels}
              />
              <Formula label="Personal" parts={Object.entries(e?.personal_weights ?? {}).map(([k, v]) => [k, v])} labels={cfg?.component_labels} />
              <div className="rounded-lg bg-brand-50 px-4 py-3 font-mono text-[13px] text-brand-800">
                score = (1 − α) · cold + α · personal,&nbsp;&nbsp; α = min(actions / {e?.cold_start_actions ?? 5}, 1)
              </div>
            </div>
          </Panel>
          <Panel title="Order on every request">
            <ol className="grid gap-2 text-sm sm:grid-cols-2">
              {[
                ["Eligibility filter", "Rules first: status, expiry, country, promotional, gated, admin blocks"],
                ["Scoring", "Every eligible item scored with numpy — no retrieval stage needed"],
                ["Drop completed & dismissed", "Finished items drop out; partly watched → Continue watching"],
                ["Admin overrides", "Pins beat the model"],
                ["Diversity", "Max 3 items per topic in a row of 6"],
                ["Exploration", "~10% to less-seen items, seeded so rehearsals repeat"],
                ["Reason", "Fixed, pre-approved template from the top signal"],
                ["Impression log", "Every item shown is logged with signals, model version and slot"],
              ].map(([t, d], i) => (
                <li key={t} className="flex gap-3 rounded-lg border p-3">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-700 text-xs font-semibold text-white">{i + 1}</span>
                  <span>
                    <span className="block font-medium">{t}</span>
                    <span className="block text-xs text-muted-foreground">{d}</span>
                  </span>
                </li>
              ))}
            </ol>
          </Panel>
          <Panel title="Level 1 rules" sub="Therapy-area switching">
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              <li>Starting bonus for the TA mapped from declared specialty: <b className="text-foreground">{e?.specialty_bonus}</b> points</li>
              <li>Points per event: open 1 · article read 3 · video 25% / 50% / 100% → 1 / 2 / 3 · dismiss −3</li>
              <li>A new TA must beat the current landing TA by <b className="text-foreground">{Math.round((e?.switch_margin ?? 0.15) * 100)}%</b> — one stray click never flips the home page</li>
              <li>Time decay: 30-day half-life, so recent behaviour weighs more</li>
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  )
}

function Formula({ label, parts, labels }: { label: string; parts: [string, number][]; labels?: Record<string, { en: string }> }) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="flex h-8 w-full gap-[2px] overflow-hidden rounded-md">
        {parts.map(([k, v]) => (
          <div key={k} className="flex items-center justify-center bg-brand-100 px-2 text-[11.5px] font-medium text-brand-800 first:rounded-s-md last:rounded-e-md" style={{ width: `${v * 100}%` }}>
            <span className="truncate">{labels?.[k]?.en ?? k} · {Math.round(v * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
