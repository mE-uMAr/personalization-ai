// Admin dashboard and CRM view language (English / Arabic), kept separate from the HCP's own
// site language so an admin can switch without changing what the HCP sees.
import { useSyncExternalStore } from "react"
import type { Lang } from "./api"

const KEY = "pe-admin-lang"
const listeners = new Set<() => void>()
let lang: Lang = localStorage.getItem(KEY) === "ar" ? "ar" : "en"

export const adminLang = {
  get: () => lang,
  set(l: Lang) {
    lang = l
    localStorage.setItem(KEY, l)
    listeners.forEach((f) => f())
  },
  subscribe(f: () => void) {
    listeners.add(f)
    return () => listeners.delete(f)
  },
}

window.addEventListener("storage", (e) => {
  if (e.key === KEY) {
    lang = e.newValue === "ar" ? "ar" : "en"
    listeners.forEach((f) => f())
  }
})

export function useAdmin() {
  const l = useSyncExternalStore(adminLang.subscribe, adminLang.get)
  const ar = l === "ar"
  return {
    lang: l,
    ar,
    dir: ar ? ("rtl" as const) : ("ltr" as const),
    /** Pick the string for the current admin language. */
    L: (en: string, arText: string) => (ar ? arText : en),
    /** Numbers stay in Western digits in both languages (clearer in mixed tables). */
    n: (v: number, digits = 0) => v.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits }),
    pct: (v: number, digits = 1) => `${(v * 100).toFixed(digits)}%`,
    time: (iso: string) => new Date(iso).toLocaleTimeString(ar ? "ar-AE-u-nu-latn" : "en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    dateTime: (iso: string) => new Date(iso).toLocaleString(ar ? "ar-AE-u-nu-latn" : "en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" }),
  }
}

export const SLOT_LABEL: Record<string, [string, string]> = {
  home_recommended: ["Home · recommended for you", "الرئيسية · موصى به لك"],
  ta_page: ["Therapy-area page", "صفحة المجال العلاجي"],
  peers: ["Popular with peers", "شائع بين الزملاء"],
  start_here: ["Start here", "ابدأ من هنا"],
  next: ["Up next (after an item)", "التالي (بعد المحتوى)"],
  continue_watching: ["Continue watching", "تابع المشاهدة"],
}

export const LEVEL_LABEL: Record<string, [string, string]> = {
  L1: ["Therapy area", "المجال العلاجي"],
  L2: ["Individual behaviour", "السلوك الفردي"],
  L3: ["Peer segment", "شريحة الزملاء"],
  editor: ["Editor's pick", "اختيار المحرر"],
  exploration: ["Discovery", "استكشاف"],
}
