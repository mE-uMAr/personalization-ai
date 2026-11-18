import { Link } from "react-router"
import { CheckCircle2, Clock, EyeOff, Info, PlayCircle, FileText, Megaphone } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { TaDot } from "@/components/brand"
import type { Card, RecItem } from "@/lib/api"
import { fmtDuration, readMinutes, useT } from "@/lib/i18n"
import { useConfig } from "@/lib/hooks"
import { track } from "@/lib/track"
import { cn } from "@/lib/utils"

function Meta({ card }: { card: Card }) {
  const { t, lang } = useT()
  return (
    <div className="flex items-center gap-2 text-[11.5px] text-muted-foreground">
      {card.type === "video" ? (
        <span className="inline-flex items-center gap-1"><PlayCircle className="size-3.5" />{t("video")} · {fmtDuration(card.duration_seconds, lang)}</span>
      ) : (
        <span className="inline-flex items-center gap-1"><FileText className="size-3.5" />{readMinutes(card.word_count)} {t("min_read")}</span>
      )}
      {card.promotional && (
        <span className="inline-flex items-center gap-1 text-ember-600"><Megaphone className="size-3" />{t("promotional")}</span>
      )}
    </div>
  )
}

export function Poster({ card, className, showProgress = true }: { card: Card; className?: string; showProgress?: boolean }) {
  const { t, lang } = useT()
  const cfg = useConfig()
  const ta = cfg?.therapy_areas.find((x) => x.id === card.therapy_area)
  return (
    <div className={cn("relative aspect-[16/9] overflow-hidden rounded-lg bg-brand-100", className)}>
      {card.media?.poster && (
        <img src={card.media.poster} alt="" loading="lazy" className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/0 to-black/0" />
      {card.type === "video" && (
        <div className="absolute inset-0 grid place-items-center">
          <span className="grid size-11 place-items-center rounded-full bg-white/90 text-brand-700 shadow-lg backdrop-blur transition group-hover:scale-110">
            <PlayCircle className="size-6" />
          </span>
        </div>
      )}
      {ta && (
        <span className="absolute start-2.5 top-2.5 inline-flex items-center gap-1.5 rounded-full bg-white/92 px-2 py-0.5 text-[10.5px] font-medium text-foreground shadow-sm">
          <TaDot color={ta.color} />
          {ta[lang]}
        </span>
      )}
      {card.completed && (
        <span className="absolute end-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[10.5px] font-medium text-white">
          <CheckCircle2 className="size-3" /> {t("completed")}
        </span>
      )}
      {showProgress && card.progress > 0 && !card.completed && (
        <div className="absolute inset-x-0 bottom-0 h-1 bg-white/30">
          <div className="h-full bg-ember-500" style={{ width: `${card.progress}%` }} />
        </div>
      )}
    </div>
  )
}

export function ItemCard({ card, rec, compact = false, onDismiss }: { card: Card; rec?: RecItem; compact?: boolean; onDismiss?: () => void }) {
  return (
    <div className="group relative flex flex-col gap-2.5">
      <Link to={`/site/item/${card.item_id}`} className="flex flex-col gap-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg">
        <Poster card={card} />
        <div className="flex flex-col gap-1 px-0.5">
          <Meta card={card} />
          <h3 className={cn("font-heading leading-snug text-foreground group-hover:text-brand-700", compact ? "text-[15px]" : "text-[16.5px]")}>
            {card.title}
          </h3>
          {!compact && <p className="line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">{card.summary}</p>}
        </div>
      </Link>
      {rec && <ReasonLine rec={rec} onDismiss={onDismiss} />}
    </div>
  )
}

export function ReasonLine({ rec, onDismiss }: { rec: RecItem; onDismiss?: () => void }) {
  const { t, lang } = useT()
  const cfg = useConfig()
  const comps = Object.entries(rec.signals ?? {}).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])
  const total = comps.reduce((s, [, v]) => s + v, 0) || 1
  return (
    <div className="flex items-center gap-1.5 px-0.5">
      <Popover>
        <PopoverTrigger asChild>
          <button className="group/why inline-flex min-w-0 items-center gap-1.5 rounded-md text-start text-[12.5px] text-brand-700 hover:text-brand-800">
            <Info className="size-3.5 shrink-0 opacity-60" />
            <span className="truncate font-medium">{rec.reason.text}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-0">
          <div className="px-4 py-3">
            <div className="text-xs font-medium text-muted-foreground">{t("why_this")}</div>
            <p className="mt-1 text-sm font-medium leading-snug">{rec.reason.text}</p>
          </div>
          {comps.length > 0 && (
            <div className="space-y-2 border-t px-4 py-3">
              {comps.slice(0, 4).map(([k, v]) => (
                <div key={k} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1">
                  <span className="text-xs text-muted-foreground">{cfg?.component_labels[k]?.[lang] ?? k}</span>
                  <span className="num text-xs font-medium">{((v / total) * 100).toFixed(0)}%</span>
                  <div className="col-span-2 h-1 rounded-full bg-muted">
                    <div className="h-full rounded-full bg-brand-600" style={{ width: `${(v / total) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </PopoverContent>
      </Popover>
      {onDismiss && (
        <button
          title={t("not_relevant")}
          aria-label={t("not_relevant")}
          onClick={() => {
            track("dismiss", rec.item_id)
            onDismiss()
          }}
          className="ms-auto rounded-md p-1 text-muted-foreground/60 opacity-0 transition hover:bg-muted hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100"
        >
          <EyeOff className="size-3.5" />
        </button>
      )}
    </div>
  )
}

export function ProgressPill({ pct }: { pct: number }) {
  const { t } = useT()
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground num">
      <Clock className="size-3" /> {pct}% {t("watched")}
    </span>
  )
}
