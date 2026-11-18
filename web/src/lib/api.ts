// Typed client for the engine API (/api/v1). Field names mirror the backend contracts.

export type Lang = "en" | "ar"
export type Level = "L1" | "L2" | "L3" | "editor" | "exploration"

export interface Card {
  item_id: string
  type: "article" | "video"
  title: string
  summary: string
  therapy_area: string
  topic: string
  promotional: boolean
  gated: boolean
  duration_seconds: number | null
  word_count: number | null
  published_date: string
  media: { poster: string } | null
  approval_code: string
  progress: number
  completed: boolean
}

export interface RecItem {
  item_id: string
  score: number
  level: Level
  reason: { template: string; params: Record<string, unknown>; text: string }
  signals: Record<string, number>
  model_version: string
  item: Card
}

export interface RecResponse {
  request_id: string
  slot: string
  hcp_id: string
  model_version: string
  fallback: string | null
  rank_ms: number
  items: RecItem[]
  eligible_count: number
  removed_count: number
}

export interface TaEntry {
  ta: string
  rank: number
  name: string
  score: number
  share: number
  landing: boolean
  color: string
  placeholder: boolean
  eligible_items: number
}

export interface ClusterBrief {
  cluster_id: number
  label: string
  label_en: string
  label_ar: string
  size: number
  source: "seed" | "provisional" | "assigned"
}

export interface Home {
  rows: RecResponse[]
  therapy_areas: TaEntry[]
  alpha: number
  landing_ta: string
  cluster: ClusterBrief | null
}

export interface Hcp {
  hcp_id: string
  name: string | null
  specialty: string
  profession: string
  country: string
  language: Lang
  verified: boolean
  tracking_consent: boolean
  crm_consent: boolean
  synthetic: boolean
  state: "anonymous" | "registered" | "verified"
}

export interface TherapyAreaCfg {
  id: string
  en: string
  ar: string
  placeholder: boolean
  color: string
}

export interface SiteConfig {
  therapy_areas: TherapyAreaCfg[]
  specialties: Record<string, { en: string; ar: string; ta: string }>
  countries: Record<string, { en: string; ar: string }>
  topics: Record<string, { en: string; ar: string; ta: string }>
  country_rules: Record<string, { promotional_allowed: boolean }>
  model_version: string
  embedding: string
  embedding_dim: number
  clustering: string
  engine: {
    specialty_bonus: number
    switch_margin: number
    cold_start_actions: number
    cold_weights: Record<string, number>
    personal_weights: Record<string, number>
  }
  component_labels: Record<string, { en: string; ar: string }>
  rule_text: Record<string, string>
  switches: { engine_down: boolean; paused: boolean; demo_run: string }
}

export interface VideoInfo {
  file: string
  captions: string
  captions_alt: string
  duration_seconds: number
  chapters: { start: number; title: string }[]
  poster: string
  language: Lang
  width: number
  height: number
  source: { provider: string; clip_id: number; clip_name: string; license: string; license_url: string; url: string }
  pipeline: { step: string; mode: "real" | "simulated"; detail: string }[]
}

export interface ItemDetail extends Card {
  body: { heading: string; text: string }[] | null
  transcript: string | null
  topics: string[]
  approval_date: string
  expiry_date: string
  allowed_countries: string[]
  video?: VideoInfo
}

export interface LensData {
  hcp: Pick<Hcp, "hcp_id" | "specialty" | "country" | "language" | "verified" | "tracking_consent" | "crm_consent" | "synthetic">
  alpha: number
  actions: number
  landing_ta: string
  prior_ta: string
  ta: TaEntry[]
  switch_gap: Record<string, number>
  switches: { from: string; to: string; at_action: number; ts: string }[]
  cluster: ClusterBrief | null
  cluster_assign_at: number
  events: { event_id: string; item_id: string | null; event_type: string; value: string | null; ts: string; title: string | null }[]
  last: Record<string, {
    request_id: string; slot: string; ts: string; rank_ms: number; fallback: string | null; model_version: string; alpha: number
    items: { item_id: string; title: Record<Lang, string>; score: number; level: Level; components: Record<string, number>; reason: string }[]
  }>
  component_labels: Record<string, { en: string; ar: string }>
  eligible: number
  removed: Record<string, string>
  switches_state: { engine_down: boolean; paused: boolean }
  crm: { delivered: number; queued: number }
  model_version: string
}

class ApiError extends Error {
  status: number
  detail: unknown
  constructor(status: number, detail: unknown) {
    super(typeof detail === "string" ? detail : `HTTP ${status}`)
    this.status = status
    this.detail = detail
  }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`/api/v1${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  })
  if (!r.ok) {
    let detail: unknown = r.statusText
    try {
      detail = (await r.json()).detail
    } catch {
      /* not json */
    }
    throw new ApiError(r.status, detail)
  }
  return r.json() as Promise<T>
}

const qs = (o: Record<string, string | number | null | undefined>) => {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(o)) if (v !== null && v !== undefined && v !== "") p.set(k, String(v))
  const s = p.toString()
  return s ? `?${s}` : ""
}

export const api = {
  config: () => req<SiteConfig>("/config"),
  hcp: (id: string) => req<Hcp>(`/hcps/${id}`),
  register: (body: Record<string, unknown>) =>
    req<{ hcp_id: string; landing_ta: string; cluster: ClusterBrief | null }>("/hcps", { method: "POST", body: JSON.stringify(body) }),
  home: (p: { hcp_id?: string | null; lang: Lang; session_id: string; country?: string }) => req<Home>(`/home${qs(p)}`),
  ta: (ta: string, p: { hcp_id?: string | null; lang: Lang; session_id: string; country?: string }) =>
    req<{ ta: TherapyAreaCfg & { name: string }; ranked: RecResponse; browse: Card[]; therapy_areas: TaEntry[] }>(`/ta/${ta}${qs(p)}`),
  item: (id: string, p: { hcp_id?: string | null; lang: Lang; session_id: string; country?: string }) =>
    req<{ item: ItemDetail; next: RecResponse }>(`/items/${id}${qs(p)}`),
  event: (body: Record<string, unknown>) =>
    req<{ stored: boolean; landing_ta?: string; switched?: boolean; actions?: number; capture_ms?: number; reason?: string;
      cluster_change?: { from: number | null; to: number } | null }>("/events", { method: "POST", body: JSON.stringify(body) }),
  lens: (id: string, lang: Lang) => req<LensData>(`/lens/${id}${qs({ lang })}`),
  analytics: () => req<Analytics>("/analytics"),
  ab: () => req<AbResult>("/ab/example"),
  clusters: (lang: Lang) => req<ClustersData>(`/clusters${qs({ lang })}`),
  oceAccounts: (q?: string) => req<{ accounts: OceAccountRow[]; adapter: string; sync_seconds: number }>(`/oce/accounts${qs({ q })}`),
  oceAccount: (id: string) => req<OceAccount>(`/oce/accounts/${id}`),
  content: (country: string, state: string, lang: Lang) =>
    req<ContentData>(`/admin/content${qs({ country, state, lang })}`),
  expire: (id: string) => req(`/admin/items/${id}/expire`, { method: "POST" }),
  restore: (id: string) => req(`/admin/items/${id}/restore`, { method: "POST" }),
  override: (body: { action: "pin" | "block"; country: string; therapy_area?: string | null; item_id: string }) =>
    req("/admin/overrides", { method: "POST", body: JSON.stringify(body) }),
  clearOverrides: (item_id?: string) => req(`/admin/overrides${qs({ item_id })}`, { method: "DELETE" }),
  impressions: (id: string, lang: Lang) => req<{ impressions: ImpressionRow[] }>(`/admin/hcps/${id}/impressions${qs({ lang })}`),
  demoState: () => req<DemoState>("/demo/state"),
  switches: (body: { engine_down?: boolean; paused?: boolean }) =>
    req<{ engine_down: boolean; paused: boolean }>("/demo/switches", { method: "POST", body: JSON.stringify(body) }),
  reset: () => req<{ new_run: string; deleted: Record<string, number> }>("/demo/reset", { method: "POST" }),
  catalogue: (lang: Lang) => req<{ items: Card[]; picks: Record<string, string[]> }>(`/catalogue${qs({ lang })}`),
}

export interface Analytics {
  window_days: number
  kpis: {
    impressions: number; clicks: number; ctr: number; completion_after_click: number; return_visits: number
    session_coverage: number; catalogue_coverage: number; events: number; active_hcps: number; sessions: number
  }
  by_level: { level: Level; impressions: number; clicks: number; completions: number; ctr: number; completion_after_click: number }[]
  by_slot: { slot: string; impressions: number; clicks: number; completions: number; ctr: number; completion_after_click: number }[]
  daily: { day: string; impressions: number; clicks: number; events: number; hcps: number; ctr: number }[]
  top_content: { item_id: string; opens: number; completions: number; hcps: number; title: Record<Lang, string>; therapy_area: string; type: string }[]
  by_ta: { ta: string; opens: number; hcps: number }[]
  by_country: { country: string; language: string; hcps: number; opens: number }[]
  formats: { video_opens: number; article_opens: number; video_completions: number; article_reads: number }
  live_run: { run: string; events: number; hcps: number; impressions: number; last_ts: string | null }
}

export interface AbResult {
  experiment_id: string
  simulated: boolean
  attribution: Record<string, number>
  slot: string
  metric: string
  arms: { variant: string; label: string; impressions: number; clicks: number; hcps: number; ctr: number }[]
  lift?: number
  lift_ci?: [number, number]
  diff_ci?: [number, number]
  z?: number
  p_value?: number
  small_sample?: boolean
}

export interface ClusterInfo {
  cluster_id: number
  label: string
  label_en: string
  label_ar: string
  size: number
  behaviours: string[]
  specialties: Record<string, number>
  countries: Record<string, number>
  format: string
  x: number
  y: number
  top_tas: { ta: string; share: number; name: string; color: string }[]
  top_items: { item_id: string; title: string; type: string; score: number }[]
}

export interface ClustersData {
  clusters: ClusterInfo[]
  points: { hcp_id: string; cluster_id: number | null; cluster_source: string | null; x: number; y: number; synthetic: boolean; live: boolean; persona: string | null; specialty: string; country: string; name: string | null }[]
  stats: { hcps: number; noise: number; min_cluster_size: number; implementation: string; features: string[] }
}

export interface OceAccountRow {
  hcp_id: string; full_name: string; oce_id: string; specialty: string; specialty_label: string; country: string
  cluster_id: number | null; live: boolean; last_sync: string | null; engagements: number; segment: string | null
}

export interface OceAccount {
  hcp_id: string; name: string; oce_id: string; specialty: string; specialty_label: string; country: string; live: boolean
  segment: ClusterBrief | null
  ta_affinity: { ta: string; name: string; share: number; color: string }[]
  landing_ta: string
  engagement: { item_id: string; title: string; type: string; event_type: string; value: string | null; therapy_area: string; timestamp: string; delivered_at: string | null }[]
  recommendations: { item_id: string; title: string; score: number; level: string; reason: string }[]
  recommendations_meta: { source: string; delivered_at: string | null }
  sync: { delivered: number; queued: number; last: string | null; adapter: string }
  raw: Record<string, unknown>
}

export interface ContentRow {
  item_id: string; title: string; type: string; therapy_area: string; topic: string; status: string; promotional: boolean
  gated: boolean; allowed_countries: string[]; expiry_date: string; approval_code: string; eligible: boolean
  rule: string | null; rule_text: string | null; impressions: number
  pipeline: { step: string; mode: string; detail: string }[] | null
}

export interface ContentData {
  viewer: { country: string; state: string }
  items: ContentRow[]
  overrides: { action: string; country: string; ta?: string | null; item_id: string }[]
  eligible: number
  country_rules: Record<string, { promotional_allowed: boolean }>
}

export interface ImpressionRow {
  impression_id: string; request_id: string; item_id: string; title: string; slot: string; rank: number; score: number
  level: Level; reason: string; reason_template: string; signals: { components?: Record<string, number>; alpha?: number; landing_ta?: string; cluster_id?: number | null; fallback?: string | null }
  model_version: string; experiment_variant: string | null; ts: string
}

export interface DemoState {
  switches: { engine_down: boolean; paused: boolean }
  demo_run: string
  personas: { hcp_id: string; name: string; label: string; specialty: string; country: string; language: Lang; verified: boolean; tracking_consent: boolean; crm_consent: boolean }[]
}

export { ApiError }
