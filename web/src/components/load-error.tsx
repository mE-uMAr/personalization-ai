import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useT } from "@/lib/i18n"

export function LoadError({ onRetry }: { onRetry: () => void }) {
  const { lang } = useT()
  return (
    <div className="rounded-xl border bg-white px-6 py-10 text-center">
      <p className="font-medium">{lang === "ar" ? "تعذر تحميل المحتوى" : "We couldn't load this content"}</p>
      <p className="mt-1 text-sm text-muted-foreground">{lang === "ar" ? "يرجى المحاولة مرة أخرى بعد قليل." : "Please try again in a moment."}</p>
      <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
        <RefreshCw className="size-4" />
        {lang === "ar" ? "إعادة المحاولة" : "Try again"}
      </Button>
    </div>
  )
}
