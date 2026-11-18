import { Link, useParams } from "react-router"
import { ArrowLeft } from "lucide-react"
import type { Lang } from "@/lib/api"
import { useT } from "@/lib/i18n"

type Page = { title: Record<Lang, string>; body: Record<Lang, string[]> }

const PAGES: Record<string, Page> = {
  about: {
    title: { en: "About Clinical Hub", ar: "عن المنصة السريرية" },
    body: {
      en: [
        "Clinical Hub is an educational platform for healthcare professionals, with approved articles and videos across five therapy areas in English and Arabic.",
        "Content is selected and ordered for each registered professional based on their specialty and the content they choose to read and watch. All content is reviewed and approved before publication.",
      ],
      ar: [
        "المنصة السريرية منصة تعليمية لمتخصصي الرعاية الصحية، تضم مقالات ومقاطع فيديو معتمدة في خمسة مجالات علاجية باللغتين العربية والإنجليزية.",
        "يتم اختيار المحتوى وترتيبه لكل متخصص مسجل وفقاً لتخصصه وللمحتوى الذي يختار قراءته ومشاهدته، وتتم مراجعة جميع المحتويات واعتمادها قبل النشر.",
      ],
    },
  },
  "side-effects": {
    title: { en: "Report a side effect", ar: "الإبلاغ عن أثر جانبي" },
    body: {
      en: [
        "If you become aware of a suspected adverse event associated with any product mentioned on this site, please report it.",
        "Contact the local pharmacovigilance team for your market, or report through your national reporting system. Please include the product name, a description of the event and how to contact you.",
      ],
      ar: [
        "إذا علمت بحدوث أثر جانبي مشتبه به مرتبط بأي منتج مذكور على هذا الموقع، يرجى الإبلاغ عنه.",
        "تواصل مع فريق اليقظة الدوائية المحلي في سوقك، أو أبلغ من خلال نظام الإبلاغ الوطني، مع ذكر اسم المنتج ووصف الحدث ووسيلة التواصل معك.",
      ],
    },
  },
  contact: {
    title: { en: "Contact", ar: "اتصل بنا" },
    body: {
      en: ["For questions about the platform or its content, contact the medical information team for your market."],
      ar: ["للاستفسار عن المنصة أو محتواها، تواصل مع فريق المعلومات الطبية في سوقك."],
    },
  },
  terms: {
    title: { en: "Terms of use", ar: "شروط الاستخدام" },
    body: {
      en: ["This site is intended for healthcare professionals only. Content is provided for educational purposes and does not replace the approved local product information."],
      ar: ["هذا الموقع مخصص لمتخصصي الرعاية الصحية فقط. يُقدَّم المحتوى لأغراض تعليمية ولا يغني عن معلومات المنتج المعتمدة محلياً."],
    },
  },
  privacy: {
    title: { en: "Privacy", ar: "الخصوصية" },
    body: {
      en: [
        "Your identity is stored separately from your activity. Activity is linked to a pseudonymous identifier and is used only if you consent to personalisation.",
        "Your activity is shared with your company representative only if you give separate consent. You can withdraw either consent at any time.",
      ],
      ar: [
        "تُحفظ هويتك بشكل منفصل عن نشاطك، ويرتبط النشاط بمعرّف مستعار ولا يُستخدم إلا بموافقتك على التخصيص.",
        "لا تتم مشاركة نشاطك مع ممثل الشركة إلا بموافقة منفصلة، ويمكنك سحب أي من الموافقتين في أي وقت.",
      ],
    },
  },
}

export default function InfoPage() {
  const { page = "about" } = useParams()
  const { t, lang } = useT()
  const p = PAGES[page] ?? PAGES.about
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Link to="/site" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-brand-700">
        <ArrowLeft className="size-4 rtl:rotate-180" /> {t("back")}
      </Link>
      <h1 className="mt-6 font-heading text-[32px]">{p.title[lang]}</h1>
      <div className="mt-6 space-y-4 text-[16.5px] leading-[1.85] text-foreground/85">
        {p.body[lang].map((x) => <p key={x}>{x}</p>)}
      </div>
    </div>
  )
}
