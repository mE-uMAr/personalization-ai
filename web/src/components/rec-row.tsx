import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Link } from "react-router"
import { EyeOff } from "lucide-react"
import { ItemCard } from "@/components/item-card"
import type { RecResponse, TaEntry } from "@/lib/api"
import { tr, useT, type StrKey } from "@/lib/i18n"
import { track } from "@/lib/track"
import { cn } from "@/lib/utils"

const UNDO_MS = 5000

export function RecRow({ row, title, subtitle, cols = 3 }: { row: RecResponse; title?: string; subtitle?: React.ReactNode; cols?: 2 | 3 | 4 }) {
  const { t, lang } = useT()
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [undo, setUndo] = useState<string | null>(null)
  // "Not relevant" is sent only once the undo window has passed (or the row goes away)
  const pending = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  useEffect(() => {
    const p = pending.current
    return () => {
      p.forEach((tm, id) => {
        clearTimeout(tm)
        track("dismiss", id)
      })
      p.clear()
    }
  }, [])
  const dismiss = (id: string) => {
    setHidden((s) => new Set(s).add(id))
    setUndo(id)
    pending.current.set(id, setTimeout(() => {
      pending.current.delete(id)
      track("dismiss", id)
      setUndo((u) => (u === id ? null : u))
    }, UNDO_MS))
  }
  const restore = (id: string) => {
    clearTimeout(pending.current.get(id))
    pending.current.delete(id)
    setHidden((s) => {
      const n = new Set(s)
      n.delete(id)
      return n
    })
    setUndo(null)
  }
  const items = row.items.filter((i) => !hidden.has(i.item_id))
  if (!items.length && !undo) return null
  return (
    <section key={row.request_id} className="@container">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h2 className="font-heading text-[24px] font-semibold leading-tight tracking-tight text-[#0d1330]">{title ?? tr(`row_${row.slot}` as StrKey, lang)}</h2>
          {subtitle && <div className="mt-1 text-sm text-muted-foreground">{subtitle}</div>}
        </div>
      </div>
      <div
        className={cn(
          "grid gap-x-6 gap-y-8",
          // sized by the space the row actually has (the insight panel takes 380 px), not the window
          cols === 4 ? "@md:grid-cols-2 @3xl:grid-cols-4" : cols === 2 ? "@md:grid-cols-2" : "@md:grid-cols-2 @3xl:grid-cols-3",
        )}
      >
        {items.map((r) => (
          <ItemCard
            key={r.item_id}
            card={r.item}
            rec={r}
            compact={cols === 4}
            onDismiss={row.slot === "continue_watching" ? undefined : () => dismiss(r.item_id)}
          />
        ))}
      </div>
      {undo && createPortal(
        <div role="status" dir={lang === "ar" ? "rtl" : "ltr"} className="fixed inset-x-0 bottom-6 z-50 mx-auto flex w-fit items-center gap-3 rounded-full bg-[#0d1330] py-2 ps-4 pe-2 text-sm text-white shadow-xl">
          <EyeOff className="size-4 opacity-70" />
          {t("dismissed_note")}
          <button onClick={() => restore(undo)} className="rounded-full bg-white/15 px-3 py-1 font-medium hover:bg-white/25">{t("undo")}</button>
        </div>,
        document.body, // outside the row: @container would otherwise anchor this fixed toast to the row
      )}
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
              "group inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium shadow-[0_1px_2px_rgba(13,19,48,0.04)] transition",
              tone === "dark"
                ? on ? "border-white bg-white text-brand-800" : "border-white/25 text-white hover:border-white/60 hover:bg-white/10"
                : on ? "border-brand-700 bg-brand-700 text-white" : "border-black/10 bg-white text-foreground hover:border-brand-300 hover:text-brand-700",
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
