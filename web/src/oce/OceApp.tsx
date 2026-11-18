// Mock CRM rep view (stands in for IQVIA OCE until a sandbox exists). Deliberately styled
// like a CRM, not like our site, so it reads as data arriving in another system.
import { useEffect, useState } from "react"
import { Link, useSearchParams } from "react-router"
import { useQuery } from "@tanstack/react-query"
import { Braces, Building2, CircleDot, Cloud, FileText, PlayCircle, RefreshCw, Search, ShieldOff, Star, UserRound } from "lucide-react"
import { api, ApiError, type OceAccount } from "@/lib/api"
import { cn } from "@/lib/utils"

const EV: Record<string, string> = { item_open: "Opened", article_read: "Read article", video_progress: "Watched video", dismiss: "Marked not relevant", save: "Saved" }

export default function OceApp() {
  const [sp, setSp] = useSearchParams()
  const [q, setQ] = useState("")
  const selected = sp.get("account")
  const list = useQuery({ queryKey: ["oce", "list", q], queryFn: () => api.oceAccounts(q || undefined), refetchInterval: 4000 })
  const acc = useQuery({ queryKey: ["oce", "acc", selected], queryFn: () => api.oceAccount(selected!), enabled: !!selected, refetchInterval: 3000, retry: false })
  const [raw, setRaw] = useState(false)

  useEffect(() => {
    if (!selected && list.data?.accounts[0]) setSp({ account: list.data.accounts[0].hcp_id }, { replace: true })
  }, [selected, list.data, setSp])

  return (
    <div className="flex min-h-svh flex-col bg-[#f3f2f2] font-sans text-[13px] text-[#181818]" dir="ltr" lang="en">
      <header className="flex h-12 items-center gap-4 bg-[#16325c] px-4 text-white">
        <div className="flex items-center gap-2">
          <Cloud className="size-5 text-[#9ad0ff]" />
          <span className="font-semibold">OCE</span>
          <span className="rounded bg-white/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">Mock sandbox</span>
        </div>
        <span className="text-white/60">Rep workspace · Accounts</span>
        <div className="ms-auto flex items-center gap-3 text-xs text-white/70">
          <span className="flex items-center gap-1.5"><RefreshCw className="size-3.5" />Inbound via <span className="font-mono">{list.data?.adapter}</span> · every {list.data?.sync_seconds}s (prod: 15 min)</span>
          <Link to="/" className="rounded px-2 py-1 hover:bg-white/10">Exit</Link>
        </div>
      </header>
      <div className="flex h-10 items-center gap-1 border-b bg-white px-4 text-[13px]">
        {["Home", "Accounts", "Calls", "Content", "Reports"].map((t) => (
          <span key={t} className={cn("px-3 py-2.5", t === "Accounts" ? "border-b-[3px] border-[#0176d3] font-semibold" : "text-[#444]")}>{t}</span>
        ))}
      </div>

      <div className="grid flex-1 grid-cols-[320px_1fr] gap-3 p-3">
        <aside className="flex flex-col overflow-hidden rounded border border-[#dddbda] bg-white">
          <div className="border-b p-3">
            <div className="mb-2 flex items-center gap-2 font-semibold"><Building2 className="size-4 text-[#0176d3]" />My HCP accounts</div>
            <div className="flex items-center gap-2 rounded border border-[#c9c9c9] px-2">
              <Search className="size-3.5 text-[#706e6b]" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search accounts" className="h-8 flex-1 bg-transparent outline-none" />
            </div>
            <p className="mt-2 text-[11px] text-[#706e6b]">Only HCPs with CRM-sharing consent are ever sent.</p>
          </div>
          <ul className="flex-1 overflow-y-auto">
            {list.data?.accounts.map((a) => (
              <li key={a.hcp_id}>
                <button onClick={() => setSp({ account: a.hcp_id })} className={cn("w-full border-b border-[#eee] px-3 py-2.5 text-start hover:bg-[#f3f9ff]", selected === a.hcp_id && "bg-[#eef4ff] shadow-[inset_3px_0_0_#0176d3]")}>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[#0b5cab]">{a.full_name}</span>
                    {a.live && <span className="rounded bg-[#ffe9d6] px-1 text-[10px] font-semibold text-[#a84a00]">LIVE</span>}
                  </div>
                  <div className="text-[11.5px] text-[#706e6b]">{a.specialty_label} · {a.country} · {a.oce_id}</div>
                  <div className="text-[11px] text-[#706e6b]">{a.engagements} engagement records{a.last_sync ? ` · synced ${new Date(a.last_sync).toLocaleTimeString()}` : ""}</div>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <main className="min-w-0 space-y-3">
          {!selected && <div className="rounded border bg-white p-8 text-center text-[#706e6b]">Select an account.</div>}
          {acc.isError && (
            <div className="flex items-start gap-3 rounded border border-[#dddbda] bg-white p-6">
              <ShieldOff className="size-6 text-[#ba0517]" />
              <div>
                <div className="font-semibold">No record in the CRM for this HCP</div>
                <div className="text-[#706e6b]">{String((acc.error as ApiError).detail ?? "")}</div>
              </div>
            </div>
          )}
          {acc.data && <Record a={acc.data} raw={raw} setRaw={setRaw} />}
        </main>
      </div>
    </div>
  )
}

function Record({ a, raw, setRaw }: { a: OceAccount; raw: boolean; setRaw: (v: boolean) => void }) {
  return (
    <>
      <div className="rounded border border-[#dddbda] bg-white">
        <div className="flex flex-wrap items-center gap-4 p-4">
          <span className="grid size-12 place-items-center rounded bg-[#7f8de1] text-white"><UserRound className="size-7" /></span>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] uppercase tracking-wide text-[#706e6b]">Account · HCP</div>
            <div className="text-xl font-bold">{a.name}</div>
          </div>
          <button onClick={() => setRaw(!raw)} className={cn("flex items-center gap-1.5 rounded border px-3 py-1.5 font-semibold", raw ? "border-[#0176d3] bg-[#0176d3] text-white" : "border-[#c9c9c9] bg-white text-[#0176d3] hover:bg-[#f3f9ff]")}>
            <Braces className="size-4" /> {raw ? "Hide raw payload" : "Raw payload"}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-px border-t bg-[#eee] md:grid-cols-5">
          <F k="OCE ID" v={<span className="font-mono">{a.oce_id}</span>} />
          <F k="Specialty" v={a.specialty_label} />
          <F k="Country" v={a.country} />
          <F k="Segment (engine cluster)" v={a.segment?.label_en ?? "—"} />
          <F k="Last sync" v={a.sync.last ? new Date(a.sync.last).toLocaleTimeString() : "—"} />
        </div>
      </div>

      {raw ? (
        <div className="rounded border border-[#dddbda] bg-[#1b1f2a] p-4 text-[12px] text-[#d5e2ff]">
          <div className="mb-2 flex items-center justify-between text-[11px] text-white/50">
            <span>Inbound payload · {a.sync.adapter} · {a.sync.delivered} delivered · {a.sync.queued} queued</span>
            <span>pseudonymous ID {a.hcp_id}</span>
          </div>
          <pre className="max-h-[70svh] overflow-auto whitespace-pre-wrap font-mono leading-relaxed">{JSON.stringify(a.raw, null, 2)}</pre>
        </div>
      ) : (
        <div className="grid gap-3 xl:grid-cols-[1.25fr_1fr]">
          <Card title="Recommended content for this HCP" icon={Star} right={<span className="text-[11px] text-[#706e6b]">{a.recommendations_meta.source}{a.recommendations_meta.delivered_at ? ` · ${new Date(a.recommendations_meta.delivered_at).toLocaleTimeString()}` : ""}</span>}>
            <table className="w-full">
              <thead><tr className="border-b text-start text-[11px] uppercase text-[#706e6b]"><th className="py-1.5 text-start font-semibold">#</th><th className="text-start font-semibold">Content</th><th className="text-start font-semibold">Why</th><th className="text-end font-semibold">Score</th></tr></thead>
              <tbody>
                {a.recommendations.map((r, i) => (
                  <tr key={r.item_id} className="border-b border-[#f0f0f0] align-top">
                    <td className="py-2 pe-2 text-[#706e6b]">{i + 1}</td>
                    <td className="py-2 pe-3"><div className="font-semibold text-[#0b5cab]">{r.title}</div><div className="font-mono text-[10.5px] text-[#706e6b]">{r.item_id} · {r.level}</div></td>
                    <td className="py-2 pe-3 text-[#3e3e3c]">{r.reason}</td>
                    <td className="py-2 text-end font-mono">{r.score.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-[11px] text-[#706e6b]">Suggested talking points for the next call. Content is approved; reasons are fixed templates.</p>
          </Card>
          <Card title="Therapy-area interest" icon={CircleDot} right={<span className="text-[11px] text-[#706e6b]">Lands on: <b>{a.ta_affinity[0]?.name}</b></span>}>
            <div className="space-y-2">
              {a.ta_affinity.map((t) => (
                <div key={t.ta} className="grid grid-cols-[130px_1fr_40px] items-center gap-2">
                  <span>{t.name}</span>
                  <div className="h-2 rounded bg-[#f0f0f0]"><div className="h-full rounded" style={{ width: `${t.share * 100}%`, background: t.color }} /></div>
                  <span className="text-end font-mono text-[11px]">{Math.round(t.share * 100)}%</span>
                </div>
              ))}
            </div>
          </Card>
          <Card title={`Digital engagement (${a.engagement.length})`} icon={RefreshCw} className="xl:col-span-2">
            <table className="w-full">
              <thead><tr className="border-b text-[11px] uppercase text-[#706e6b]"><th className="py-1.5 text-start font-semibold">When</th><th className="text-start font-semibold">Activity</th><th className="text-start font-semibold">Content</th><th className="text-start font-semibold">Therapy area</th><th className="text-end font-semibold">Received</th></tr></thead>
              <tbody>
                {a.engagement.map((e, i) => (
                  <tr key={i} className="border-b border-[#f0f0f0]">
                    <td className="py-1.5 pe-3 font-mono text-[11.5px]">{new Date(e.timestamp).toLocaleString()}</td>
                    <td className="pe-3">{EV[e.event_type] ?? e.event_type}{e.event_type === "video_progress" && e.value ? ` · ${e.value}%` : ""}</td>
                    <td className="pe-3"><span className="flex items-center gap-1.5">{e.type === "video" ? <PlayCircle className="size-3.5 text-[#706e6b]" /> : <FileText className="size-3.5 text-[#706e6b]" />}<span className="text-[#0b5cab]">{e.title}</span></span></td>
                    <td className="pe-3 text-[#3e3e3c]">{e.therapy_area}</td>
                    <td className="text-end font-mono text-[11px] text-[#706e6b]">{e.delivered_at ? new Date(e.delivered_at).toLocaleTimeString() : "queued"}</td>
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
    <div className="bg-white px-4 py-2.5">
      <div className="text-[11px] text-[#706e6b]">{k}</div>
      <div className="truncate font-semibold">{v}</div>
    </div>
  )
}

function Card({ title, icon: Icon, right, children, className }: { title: string; icon: React.ElementType; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded border border-[#dddbda] bg-white", className)}>
      <div className="flex items-center justify-between gap-2 border-b border-[#dddbda] bg-[#f3f3f3] px-4 py-2.5">
        <h3 className="flex items-center gap-2 font-bold"><span className="grid size-6 place-items-center rounded bg-[#0176d3] text-white"><Icon className="size-3.5" /></span>{title}</h3>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}
