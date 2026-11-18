import { useState } from "react"
import { Link } from "react-router"
import { ItemCard } from "@/components/item-card"
import type { RecResponse, TaEntry } from "@/lib/api"
import { tr, useT, type StrKey } from "@/lib/i18n"
import { cn } from "@/lib/utils"

export function RecRow({ row, title, subtitle, cols = 3 }: { row: RecResponse; title?: string; subtitle?: React.ReactNode; cols?: 2 | 3 | 4 }) {
  const { lang } = useT()
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const items = row.items.filter((i) => !hidden.has(i.item_id))
  if (!items.length) return null
  return (
    <section key={row.request_id}>
      <div className="mb-5 flex items-end justify-between gap-4 border-b pb-3">
        <div>
          <h2 className="font-heading text-[23px] leading-tight text-foreground">{title ?? tr(`row_${row.slot}` as StrKey, lang)}</h2>
          {subtitle && <div className="mt-1 text-sm text-muted-foreground">{subtitle}</div>}
        </div>
      </div>
      <div
        className={cn(
          "grid gap-x-6 gap-y-8",
          cols === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : cols === 2 ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3",
        )}
      >
        {items.map((r) => (
          <ItemCard
            key={r.item_id}
            card={r.item}
            rec={r}
            compact={cols === 4}
            onDismiss={row.slot === "continue_watching" ? undefined : () => setHidden((s) => new Set(s).add(r.item_id))}
          />
        ))}
      </div>
    </section>
  )
}

// Level 1 output as plain navigation: the order is the personalisation.
export function TaNav({ tas, active, tone = "light" }: { tas: TaEntry[]; active?: string; tone?: "light" | "dark" }) {
  const { t } = useT()
  return (
    <nav aria-label={t("your_tas")} className="flex flex-wrap gap-2">
      {tas.map((ta) => {
        const on = ta.ta === active
        return (
          <Link
            key={ta.ta}
            to={`/site/ta/${ta.ta}`}
            className={cn(
              "group inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition",
              tone === "dark"
                ? on ? "border-white bg-white text-brand-800" : "border-white/25 text-white hover:border-white/60 hover:bg-white/10"
                : on ? "border-brand-700 bg-brand-700 text-white" : "border-border bg-white text-foreground hover:border-brand-300",
            )}
          >
            <span className="size-2 rounded-full" style={{ background: ta.color }} />
            {ta.name}
            <span className={cn("num text-xs", on ? "opacity-80" : "text-muted-foreground", tone === "dark" && !on && "text-white/60")}>{ta.eligible_items}</span>
          </Link>
        )
      })}
    </nav>
  )
}
