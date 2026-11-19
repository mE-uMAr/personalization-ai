import { cn } from "@/lib/utils"
import type { Level } from "@/lib/api"

// Product mark: a focal point with two widening arcs (one HCP, the signals around them).
// Drawn for this project; not derived from any third-party logo.
export function BrandMark({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  const fg = inverted ? "#0d1b6b" : "#ffffff"
  return (
    <svg viewBox="0 0 40 40" className={cn("size-9 shrink-0", className)} aria-hidden>
      <defs>
        <linearGradient id="pe-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1534c4" />
          <stop offset="1" stopColor="#0d1b6b" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill={inverted ? "#ffffff" : "url(#pe-mark)"} />
      <circle cx="13" cy="27" r="3.6" fill="#fa5c00" />
      <path d="M13 17.5a9.5 9.5 0 0 1 9.5 9.5" fill="none" stroke={fg} strokeWidth="3.2" strokeLinecap="round" />
      <path d="M13 9.5A17.5 17.5 0 0 1 30.5 27" fill="none" stroke={fg} strokeWidth="3.2" strokeLinecap="round" opacity="0.55" />
    </svg>
  )
}

// HCP portal mark ("Clinical Hub"): a rounded plus inside a soft square.
export function SiteMark({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <svg viewBox="0 0 40 40" className={cn("size-9 shrink-0", className)} aria-hidden>
      <rect width="40" height="40" rx="12" fill={inverted ? "#ffffff" : "#002399"} />
      <path d="M20 11v18M11 20h18" stroke={inverted ? "#002399" : "#ffffff"} strokeWidth="5" strokeLinecap="round" />
      <circle cx="29" cy="11" r="3.2" fill="#fa5c00" />
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
