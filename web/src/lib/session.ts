// Who is browsing the HCP site right now (demo identity), their language, and the session ID.
// Shared across tabs via localStorage so the launcher, site and console stay in sync.
import { useSyncExternalStore } from "react"
import type { Lang } from "./api"

interface SessionState {
  hcpId: string | null
  lang: Lang
  anonCountry: string
}

const KEY = "hcp-demo-session-v2"
const listeners = new Set<() => void>()

// Placeholder market codes used before the switch to ISO 3166 (saved in browsers from earlier sessions)
const OLD_CODES: Record<string, string> = { MA: "SA", MB: "AE", MC: "KW", MD: "QA", ME: "BH", MF: "OM", MG: "IQ", MH: "EG" }

function load(): SessionState {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null")
    if (v && typeof v === "object") return { hcpId: v.hcpId ?? null, lang: v.lang === "ar" ? "ar" : "en", anonCountry: OLD_CODES[v.anonCountry] ?? v.anonCountry ?? "AE" }
  } catch {
    /* ignore */
  }
  return { hcpId: null, lang: "en", anonCountry: "AE" }
}

let state = load()

function emit() {
  localStorage.setItem(KEY, JSON.stringify(state))
  document.documentElement.lang = state.lang
  document.documentElement.dir = state.lang === "ar" ? "rtl" : "ltr"
  listeners.forEach((l) => l())
}

window.addEventListener("storage", (e) => {
  if (e.key === KEY) {
    state = load()
    document.documentElement.lang = state.lang
    document.documentElement.dir = state.lang === "ar" ? "rtl" : "ltr"
    listeners.forEach((l) => l())
  }
})

export const session = {
  get: () => state,
  setHcp(hcpId: string | null, lang?: Lang) {
    state = { ...state, hcpId, lang: lang ?? state.lang }
    emit()
  },
  setLang(lang: Lang) {
    state = { ...state, lang }
    emit()
  },
  setAnonCountry(c: string) {
    state = { ...state, anonCountry: c }
    emit()
  },
  subscribe(l: () => void) {
    listeners.add(l)
    return () => listeners.delete(l)
  },
}

document.documentElement.lang = state.lang
document.documentElement.dir = state.lang === "ar" ? "rtl" : "ltr"

export function useSession() {
  return useSyncExternalStore(session.subscribe, session.get)
}

// One session ID per browser tab (event schema: session ID).
export const SESSION_ID: string = (() => {
  const k = "hcp-demo-sid"
  let v = sessionStorage.getItem(k)
  if (!v) {
    v = `web-${crypto.randomUUID().slice(0, 13)}`
    sessionStorage.setItem(k, v)
  }
  return v
})()

export const DEVICE = /Mobi|Android/i.test(navigator.userAgent) ? "mobile" : "desktop"
