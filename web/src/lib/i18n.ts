// HCP-site UI strings (Arabic + English). Console and CRM views are admin tools (English).
import { useSession } from "./session"
import type { Lang } from "./api"

const S = {
  brand_name: { en: "Clinical Hub", ar: "المنصة السريرية" },
  brand_tag: { en: "Medical education for healthcare professionals", ar: "التعليم الطبي لمتخصصي الرعاية الصحية" },
  nav_home: { en: "For you", ar: "مقترح لك" },
  nav_all_tas: { en: "Therapy areas", ar: "المجالات العلاجية" },
  sign_out: { en: "Sign out", ar: "تسجيل الخروج" },
  register: { en: "Register", ar: "التسجيل" },
  sign_in_as: { en: "Signed in as", ar: "مسجل الدخول باسم" },
  anon_banner: { en: "Register to access the full library for healthcare professionals.", ar: "سجّل للوصول إلى المكتبة الكاملة لمتخصصي الرعاية الصحية." },
  hello: { en: "Welcome back", ar: "مرحباً بعودتك" },
  welcome: { en: "Welcome", ar: "أهلاً بك" },
  hero_sub: { en: "Approved articles and videos across five therapy areas.", ar: "مقالات ومقاطع فيديو معتمدة في خمسة مجالات علاجية." },
  landing_ta: { en: "Your focus", ar: "تركيزك" },
  row_continue_watching: { en: "Continue watching", ar: "تابع المشاهدة" },
  row_start_here: { en: "Start here", ar: "ابدأ من هنا" },
  row_home_recommended: { en: "Recommended for you", ar: "موصى به لك" },
  row_peers: { en: "Popular with peers like you", ar: "شائع بين زملاء يشبهونك" },
  row_ta_page: { en: "Selected for you", ar: "مختار لك" },
  row_next: { en: "Up next", ar: "التالي" },
  browse_all: { en: "Browse everything", ar: "تصفح كل المحتوى" },
  browse_note: { en: "All approved content in this therapy area.", ar: "كل المحتوى المعتمد في هذا المجال العلاجي." },
  items: { en: "items", ar: "عنصر" },
  article: { en: "Article", ar: "مقال" },
  video: { en: "Video", ar: "فيديو" },
  min_read: { en: "min read", ar: "دقائق قراءة" },
  promotional: { en: "Promotional", ar: "ترويجي" },
  public: { en: "Public", ar: "عام" },
  completed: { en: "Completed", ar: "مكتمل" },
  why_this: { en: "Why this?", ar: "لماذا هذا؟" },
  not_relevant: { en: "Not relevant", ar: "غير مناسب" },
  dismissed: { en: "Hidden. We'll show you less like this.", ar: "تم الإخفاء. سنعرض لك محتوى أقل من هذا النوع." },
  save: { en: "Save", ar: "حفظ" },
  saved: { en: "Saved", ar: "محفوظ" },
  back: { en: "Back", ar: "رجوع" },
  approval: { en: "Approval", ar: "رقم الاعتماد" },
  valid_until: { en: "Valid until", ar: "صالح حتى" },
  transcript: { en: "Transcript", ar: "النص" },
  chapters: { en: "Chapters", ar: "الفصول" },
  watched: { en: "watched", ar: "تمت المشاهدة" },
  read_progress: { en: "Read", ar: "تمت قراءة" },
  not_available: { en: "This content isn't available for your account.", ar: "هذا المحتوى غير متاح لحسابك." },
  fallback_note: { en: "Editor's selection", ar: "اختيار المحررين" },
  reg_title: { en: "Create your HCP account", ar: "أنشئ حساب متخصص الرعاية الصحية" },
  reg_sub: { en: "Access approved medical content tailored to your specialty.", ar: "احصل على محتوى طبي معتمد مخصص لتخصصك." },
  full_name: { en: "Full name", ar: "الاسم الكامل" },
  email: { en: "Work email", ar: "البريد الإلكتروني للعمل" },
  specialty: { en: "Specialty", ar: "التخصص" },
  country: { en: "Country of practice", ar: "بلد الممارسة" },
  language: { en: "Preferred language", ar: "اللغة المفضلة" },
  licence: { en: "Licence number", ar: "رقم الترخيص" },
  verified_label: { en: "Licence verified", ar: "تم التحقق من الترخيص" },
  verified_help: { en: "We check your licence number against the professional register. Until it is confirmed, only non-promotional content is shown.", ar: "نتحقق من رقم ترخيصك في سجل المهنيين، وحتى يتم التأكيد يُعرض المحتوى غير الترويجي فقط." },
  consent_tracking: { en: "Personalise my experience", ar: "خصص تجربتي" },
  consent_tracking_help: { en: "Use what I read and watch on this site to recommend content.", ar: "استخدم ما أقرأه وأشاهده على هذا الموقع لاقتراح المحتوى." },
  consent_crm: { en: "Share my engagement with my company representative", ar: "شارك تفاعلي مع ممثل الشركة" },
  consent_crm_help: { en: "Your activity and recommendations are shared with the CRM so your representative can support you.", ar: "تتم مشاركة نشاطك والتوصيات مع نظام إدارة العملاء ليتمكن ممثلك من دعمك." },
  create_account: { en: "Create account", ar: "إنشاء الحساب" },
  privacy_note: { en: "Your identity is stored separately from your activity. Analytics use a pseudonymous ID only.", ar: "تُحفظ هويتك بشكل منفصل عن نشاطك. تستخدم التحليلات معرفاً مستعاراً فقط." },
  engine_lens: { en: "Engine lens", ar: "عدسة المحرك" },
  nav_about: { en: "About", ar: "من نحن" },
  nav_terms: { en: "Terms of use", ar: "شروط الاستخدام" },
  nav_privacy: { en: "Privacy", ar: "الخصوصية" },
  nav_contact: { en: "Contact", ar: "اتصل بنا" },
  nav_ae: { en: "Report a side effect", ar: "الإبلاغ عن أثر جانبي" },
  register_to_read: { en: "Register to read this content", ar: "سجّل لقراءة هذا المحتوى" },
  register_to_read_sub: { en: "This content is available to registered healthcare professionals.", ar: "هذا المحتوى متاح لمتخصصي الرعاية الصحية المسجلين." },
  pi_title: { en: "Prescribing information", ar: "معلومات الوصف" },
  pi_text: { en: "Prescribing information for this product is available from the local medical information service. Refer to the approved local product information before prescribing.", ar: "تتوفر معلومات الوصف لهذا المنتج لدى خدمة المعلومات الطبية المحلية. يُرجى الرجوع إلى معلومات المنتج المعتمدة محلياً قبل الوصف." },
  ae_text: { en: "Adverse events should be reported. Use the side-effect reporting page or contact the local pharmacovigilance team.", ar: "يجب الإبلاغ عن الآثار الجانبية. استخدم صفحة الإبلاغ أو تواصل مع فريق اليقظة الدوائية المحلي." },
  your_tas: { en: "Your therapy areas", ar: "مجالاتك العلاجية" },
  footer: { en: "For healthcare professionals only.", ar: "لمتخصصي الرعاية الصحية فقط." },
  view_all: { en: "View all", ar: "عرض الكل" },
  explore: { en: "Explore", ar: "استكشف" },
  nothing_here: { en: "Nothing to show yet.", ar: "لا يوجد شيء لعرضه بعد." },
  new: { en: "New", ar: "جديد" },
  personalised_for: { en: "Personalised for", ar: "مخصص لـ" },
  open: { en: "Open", ar: "افتح" },
  minutes: { en: "min", ar: "د" },
  seconds: { en: "s", ar: "ث" },
} as const

export type StrKey = keyof typeof S

export function tr(key: StrKey, lang: Lang): string {
  return S[key][lang]
}

export function useT() {
  const { lang } = useSession()
  return { t: (k: StrKey) => S[k][lang], lang, dir: lang === "ar" ? ("rtl" as const) : ("ltr" as const) }
}

export function fmtDuration(sec: number | null | undefined, _lang?: Lang) {
  if (!sec) return ""
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return `${m}:${String(s).padStart(2, "0")}`
}

export function fmtDate(iso: string, lang: Lang) {
  return new Intl.DateTimeFormat(lang === "ar" ? "ar" : "en-GB", { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso))
}

export function readMinutes(words: number | null | undefined) {
  return Math.max(1, Math.round((words ?? 0) / 230))
}
