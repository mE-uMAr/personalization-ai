import { COMPONENT_COLOR, COMPONENT_ORDER, COMPONENT_SHORT } from "@/components/engine-lens"

export { COMPONENT_COLOR, COMPONENT_ORDER, COMPONENT_SHORT }

// Light-surface variant of the lens stack bar (2px surface gap between segments).
export function StackBarLight({ components, max }: { components: Record<string, number>; max: number }) {
  const keys = [...COMPONENT_ORDER, "related"].filter((k) => (components[k] ?? 0) > 0)
  return (
    <div className="flex h-2 w-full gap-[2px] overflow-hidden rounded-full bg-muted">
      {keys.map((k) => (
        <div key={k} title={`${COMPONENT_SHORT[k]} ${components[k].toFixed(3)}`} className="h-full first:rounded-s-full last:rounded-e-full" style={{ width: `${(components[k] / (max || 1)) * 100}%`, background: COMPONENT_COLOR[k] }} />
      ))}
    </div>
  )
}
