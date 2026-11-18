import { Link, NavLink, Outlet } from "react-router"
import { BarChart3, FlaskConical, Gauge, LayoutDashboard, Network, ScrollText, SearchCode } from "lucide-react"
import { BrandMark } from "@/components/brand"
import { useConfig, useHcp } from "@/lib/hooks"
import { cn } from "@/lib/utils"

const NAV = [
  { to: "/console", label: "Engine lens", icon: Gauge, end: true },
  { to: "/console/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/console/clusters", label: "Clusters", icon: Network },
  { to: "/console/content", label: "Content & rules", icon: ScrollText },
  { to: "/console/inspector", label: "HCP inspector", icon: SearchCode },
  { to: "/console/ab", label: "A/B results", icon: FlaskConical },
]

export default function ConsoleLayout() {
  const cfg = useConfig()
  const hcp = useHcp()
  return (
    <div className="flex min-h-svh bg-[#f6f7fb]" dir="ltr" lang="en">
      <aside className="sticky top-0 flex h-svh w-60 shrink-0 flex-col border-e bg-white">
        <Link to="/" className="flex items-center gap-2.5 border-b px-5 py-4">
          <BrandMark className="size-8" />
          <div className="leading-tight">
            <div className="text-sm font-semibold text-brand-700">Engine console</div>
            <div className="text-[11px] text-muted-foreground">Personalization engine</div>
          </div>
        </Link>
        <nav className="flex-1 space-y-0.5 p-3">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                cn("flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition", isActive ? "bg-brand-700 text-white" : "text-foreground/70 hover:bg-muted hover:text-foreground")
              }
            >
              <n.icon className="size-4" />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="space-y-2 border-t p-4 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1.5"><LayoutDashboard className="size-3.5" />Viewing as</div>
          <div className="truncate text-xs font-medium text-foreground">{hcp.data?.name ?? "No HCP selected"}</div>
          <div className="space-y-0.5 pt-2 font-mono text-[10.5px]">
            <div>{cfg?.model_version}</div>
            <div className="truncate">{cfg?.embedding} · {cfg?.embedding_dim}d</div>
          </div>
          <div className="flex gap-3 pt-2 text-xs">
            <Link to="/site" className="text-brand-700 hover:underline">HCP site</Link>
            <Link to="/oce" className="text-brand-700 hover:underline">Mock OCE</Link>
            <Link to="/" className="text-brand-700 hover:underline">Launcher</Link>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  )
}

export function PageHeader({ title, sub, right }: { title: string; sub?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b bg-white px-8 py-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {sub && <p className="mt-0.5 text-sm text-muted-foreground">{sub}</p>}
      </div>
      {right}
    </div>
  )
}

export function Panel({ title, sub, children, className, right }: { title?: string; sub?: string; children: React.ReactNode; className?: string; right?: React.ReactNode }) {
  return (
    <section className={cn("rounded-xl border bg-white", className)}>
      {title && (
        <div className="flex items-start justify-between gap-3 border-b px-5 py-3.5">
          <div>
            <h2 className="text-sm font-semibold">{title}</h2>
            {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
          </div>
          {right}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  )
}
