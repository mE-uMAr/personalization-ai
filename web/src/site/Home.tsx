import { RecRow, TaNav } from "@/components/rec-row"
import { Skeleton } from "@/components/ui/skeleton"
import { LoadError } from "@/components/load-error"
import { useConfig, useHcp, useHome } from "@/lib/hooks"
import { useT } from "@/lib/i18n"

export default function Home() {
  const { t, lang } = useT()
  const home = useHome()
  const hcp = useHcp()
  const cfg = useConfig()
  const d = home.data
  const landing = d?.therapy_areas[0]
  const spec = hcp.data && cfg ? cfg.specialties[hcp.data.specialty]?.[lang] : null

  return (
    <div>
      <section className="relative overflow-hidden border-b border-black/[0.06] bg-white">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_80%_at_90%_0%,#e5e7fc_0%,transparent_70%)]" />
        <div className="relative mx-auto max-w-6xl px-6 pb-9 pt-11">
          <div className="text-[13px] font-medium text-brand-600">{spec ? `${spec} · ${cfg?.countries[hcp.data!.country]?.[lang]}` : t("footer")}</div>
          <h1 className="mt-2 font-heading text-[34px] font-semibold leading-tight tracking-tight text-[#0d1330] sm:text-[42px]">
            {hcp.data?.name ? `${d && d.alpha > 0 ? t("hello") : t("welcome")}${lang === "ar" ? "،" : ","} ${hcp.data.name}` : t("welcome")}
          </h1>
          <p className="mt-2 max-w-2xl text-[15.5px] text-muted-foreground">{t("hero_sub")}</p>
          <div className="mt-7">
            <div className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">{t("your_tas")}</div>
            {d ? <TaNav tas={d.therapy_areas} /> : <Skeleton className="h-10 w-full max-w-2xl" />}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-14 px-6 py-12">
        {home.isLoading && (
          <div className="space-y-4">
            <Skeleton className="h-7 w-64" />
            <div className="grid gap-6 sm:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="aspect-[16/12] rounded-lg" />)}</div>
          </div>
        )}
        {home.isError && <LoadError onRetry={() => home.refetch()} />}
        {d?.rows.map((row) => (
          <RecRow
            key={row.slot}
            row={row}
            cols={row.slot === "continue_watching" ? 4 : 3}
            subtitle={
              row.slot === "start_here" && landing ? landing.name : undefined
            }
          />
        ))}
      </div>
    </div>
  )
}
