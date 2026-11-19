import { useState } from "react"
import { useNavigate } from "react-router"
import { useMutation } from "@tanstack/react-query"
import { Loader2, Lock } from "lucide-react"
import { SiteMark } from "@/components/brand"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { api, ApiError, type Lang } from "@/lib/api"
import { useConfig } from "@/lib/hooks"
import { useT } from "@/lib/i18n"
import { session } from "@/lib/session"
import { queryClient } from "@/lib/track"

export default function Register() {
  const { t, lang } = useT()
  const cfg = useConfig()
  const nav = useNavigate()
  const [f, setF] = useState({
    full_name: "Dr. Mariam Al-Sayed", email: "mariam.alsayed@example.org", specialty: "ophthalmologist", country: "SA",
    language: lang as Lang, licence_no: "LIC-482130", tracking_consent: false, crm_consent: false,
  })
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }))
  const m = useMutation({
    mutationFn: () => api.register(f),
    onSuccess: (r) => {
      session.setHcp(r.hcp_id, f.language)
      queryClient.invalidateQueries()
      nav("/site")
    },
  })

  return (
    <div className="mx-auto grid max-w-5xl gap-10 px-6 py-12 lg:grid-cols-[1fr_1.1fr]">
      <div className="hidden flex-col justify-between rounded-3xl bg-gradient-to-br from-brand-700 to-[#0d1b6b] p-9 text-white shadow-xl shadow-brand-700/20 lg:flex">
        <div>
          <SiteMark inverted className="size-11" />
          <h1 className="mt-8 font-heading text-[34px] font-semibold leading-tight tracking-tight">{t("reg_title")}</h1>
          <p className="mt-3 text-white/75">{t("reg_sub")}</p>
        </div>
        <ul className="space-y-3 text-sm text-white/80">
          {cfg?.therapy_areas.map((ta) => (
            <li key={ta.id} className="flex items-center gap-2.5">
              <span className="size-2 rounded-full" style={{ background: ta.color }} />
              {ta[lang]}
            </li>
          ))}
        </ul>
        <p className="flex items-start gap-2 text-xs text-white/60"><Lock className="mt-0.5 size-3.5 shrink-0" />{t("privacy_note")}</p>
      </div>

      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault()
          m.mutate()
        }}
      >
        <div className="lg:hidden">
          <h1 className="font-heading text-3xl">{t("reg_title")}</h1>
          <p className="mt-1 text-muted-foreground">{t("reg_sub")}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("full_name")}><Input value={f.full_name} onChange={(e) => set("full_name", e.target.value)} required minLength={2} /></Field>
          <Field label={t("email")}><Input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} dir="ltr" /></Field>
          <Field label={t("specialty")}>
            <Select value={f.specialty} onValueChange={(v) => set("specialty", v)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {cfg && Object.entries(cfg.specialties).map(([k, v]) => <SelectItem key={k} value={k}>{v[lang]}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t("country")}>
            <Select value={f.country} onValueChange={(v) => set("country", v)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {cfg && Object.entries(cfg.countries).map(([k, v]) => <SelectItem key={k} value={k}>{v[lang]}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t("language")}>
            <Select value={f.language} onValueChange={(v) => set("language", v as Lang)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="ar">العربية</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label={t("licence")}><Input value={f.licence_no} onChange={(e) => set("licence_no", e.target.value)} dir="ltr" /></Field>
        </div>

        <p className="text-xs text-muted-foreground">{t("verified_help")}</p>
        <div className="divide-y rounded-2xl border border-black/[0.08] bg-white">
          <Toggle label={t("consent_tracking")} help={t("consent_tracking_help")} checked={f.tracking_consent} onChange={(v) => set("tracking_consent", v)} />
          <Toggle label={t("consent_crm")} help={t("consent_crm_help")} checked={f.crm_consent} onChange={(v) => set("crm_consent", v)} />
        </div>

        {m.isError && (() => {
          const d = m.error instanceof ApiError && m.error.status === 409 ? (m.error.detail as { hcp_id: string; name: string }) : null
          return d ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <span>{t("account_exists")}</span>
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={() => {
                  session.setHcp(d.hcp_id, f.language)
                  queryClient.invalidateQueries()
                  nav("/site")
                }}
              >
                {t("continue_as")} {d.name}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-destructive">{String(m.error)}</p>
          )
        })()}
        <Button type="submit" size="lg" className="h-12 w-full rounded-full bg-brand-700 text-[15px] hover:bg-brand-800" disabled={m.isPending}>
          {m.isPending && <Loader2 className="size-4 animate-spin" />}
          {t("create_account")}
        </Button>
        <p className="text-xs text-muted-foreground lg:hidden">{t("privacy_note")}</p>
      </form>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[13px] text-foreground/80">{label}</Label>
      {children}
    </div>
  )
}

function Toggle({ label, help, checked, onChange }: { label: string; help: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 p-4">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{help}</span>
      </span>
      <Switch checked={checked} onCheckedChange={onChange} className="mt-0.5" />
    </label>
  )
}
