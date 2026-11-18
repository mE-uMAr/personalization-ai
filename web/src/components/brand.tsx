import { cn } from "@/lib/utils"
import type { Level } from "@/lib/api"

export function BrandMark({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <svg viewBox="0 0 40 40" className={cn("size-9 shrink-0", className)} aria-hidden>
      <path d="M20 2 36 11v18L20 38 4 29V11Z" fill={inverted ? "#ffffff" : "#002399"} />
      <path d="M13.5 27 20 12l6.5 15" fill="none" stroke={inverted ? "#002399" : "#ffffff"} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="27.5" cy="13" r="3" fill="#fa5c00" />
    </svg>
  )
}

export const LEVEL_META: Record<Level, { label: string; long: string; className: string; dot: string }> = {
  L1: { label: "L1", long: "Level 1 · therapy area / specialty", className: "bg-[#e8edfc] text-[#0b3bc8] ring-[#0b3bc8]/15", dot: "bg-[#0b3bc8]" },
  L2: { label: "L2", long: "Level 2 · individual behaviour", className: "bg-[#efe9fd] text-[#5a2bd0] ring-[#6d3be8]/15", dot: "bg-[#6d3be8]" },
  L3: { label: "L3", long: "Level 3 · peer cluster", className: "bg-[#e3f5f3] text-[#007a6e] ring-[#009e8f]/15", dot: "bg-[#009e8f]" },
  editor: { label: "Editor", long: "Editor-curated", className: "bg-[#f1f1ef] text-[#52514e] ring-black/10", dot: "bg-[#52514e]" },
  exploration: { label: "Explore", long: "Exploration (~10%)", className: "bg-ember-50 text-ember-600 ring-ember-500/15", dot: "bg-ember-500" },
}

export function LevelBadge({ level, className }: { level: Level; className?: string }) {
  const m = LEVEL_META[level]
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ring-1 ring-inset num", m.className, className)}>
      <span className={cn("size-1.5 rounded-full", m.dot)} />
      {m.label}
    </span>
  )
}

export function TaDot({ color, className }: { color: string; className?: string }) {
  return <span className={cn("inline-block size-2 shrink-0 rounded-full", className)} style={{ background: color }} />
}

export function Hex({ className, children, color = "#002399" }: { className?: string; children?: React.ReactNode; color?: string }) {
  return (
    <div className={cn("hex-v grid place-items-center text-white", className)} style={{ background: color }}>
      {children}
    </div>
  )
}
