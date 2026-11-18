import { useMemo, useState } from "react"
import { useParams } from "react-router"
import { FileText, PlayCircle } from "lucide-react"
import { ItemCard } from "@/components/item-card"
import { RecRow, TaNav } from "@/components/rec-row"
import { Skeleton } from "@/components/ui/skeleton"
import { LoadError } from "@/components/load-error"
import { useConfig, useTaPage } from "@/lib/hooks"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"

export default function TaPage() {
  const { ta = "" } = useParams()
  const { t, lang } = useT()
  const cfg = useConfig()
  const q = useTaPage(ta)
  const [type, setType] = useState<"all" | "article" | "video">("all")
  const [topic, setTopic] = useState<string>("all")
  const d = q.data
  const topics = useMemo(() => Array.from(new Set(d?.browse.map((c) => c.topic) ?? [])), [d])
  const browse = (d?.browse ?? []).filter((c) => (type === "all" || c.type === type) && (topic === "all" || c.topic === topic))

  return (
    <div>
      <section className="border-b bg-white">
        <div className="mx-auto max-w-6xl px-6 pb-6 pt-8">
          {d ? (
            <>
              <div className="flex items-center gap-3">
                <span className="h-9 w-1.5 rounded-full" style={{ background: d.ta.color }} />
                <h1 className="font-heading text-[34px] leading-tight">{d.ta.name}</h1>
              </div>
              <p className="mt-2 text-muted-foreground num">{d.browse.length} {t("items")}</p>
              <div className="mt-6"><TaNav tas={d.therapy_areas} active={ta} /></div>
            </>
          ) : q.isError ? null : (
            <Skeleton className="h-24 w-full" />
          )}
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-14 px-6 py-10">
        {q.isError && <LoadError onRetry={() => q.refetch()} />}
        {d && d.ranked.items.length > 0 && <RecRow row={d.ranked} />}

        {d && (
          <section>
            <div className="mb-2 flex flex-wrap items-end justify-between gap-4">
              <h2 className="font-heading text-[23px]">{t("browse_all")}</h2>
              <div className="flex flex-wrap gap-2">
                <Seg value={type} onChange={(v) => setType(v as typeof type)} options={[
                  ["all", lang === "ar" ? "الكل" : "All"], ["article", <span key="a" className="flex items-center gap-1"><FileText className="size-3.5" />{t("article")}</span>],
                  ["video", <span key="v" className="flex items-center gap-1"><PlayCircle className="size-3.5" />{t("video")}</span>],
                ]} />
                <select value={topic} onChange={(e) => setTopic(e.target.value)} className="h-8 rounded-md border bg-white px-2 text-sm">
                  <option value="all">{lang === "ar" ? "كل المواضيع" : "All topics"}</option>
                  {topics.map((tp) => <option key={tp} value={tp}>{cfg?.topics[tp]?.[lang] ?? tp}</option>)}
                </select>
              </div>
            </div>
            <p className="mb-6 text-sm text-muted-foreground">{t("browse_note")}</p>
            <div className="grid gap-x-5 gap-y-7 sm:grid-cols-2 lg:grid-cols-4">
              {browse.map((c) => <ItemCard key={c.item_id} card={c} compact />)}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

function Seg({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, React.ReactNode][] }) {
  return (
    <div className="inline-flex h-8 items-center rounded-md border bg-white p-0.5 text-sm">
      {options.map(([v, label]) => (
        <button key={v} type="button" onClick={() => onChange(v)} className={cn("h-full rounded px-2.5 transition", value === v ? "bg-brand-700 text-white" : "text-foreground/70 hover:text-foreground")}>
          {label}
        </button>
      ))}
    </div>
  )
}
