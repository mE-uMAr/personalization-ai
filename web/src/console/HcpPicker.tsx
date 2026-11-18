import { useDemoState } from "@/lib/hooks"
import { session, useSession } from "@/lib/session"
import { queryClient } from "@/lib/track"

export function HcpPicker() {
  const { hcpId } = useSession()
  const demo = useDemoState()
  const ps = demo.data?.personas ?? []
  return (
    <select
      value={hcpId ?? ""}
      onChange={(e) => {
        const p = ps.find((x) => x.hcp_id === e.target.value)
        session.setHcp(e.target.value || null, p?.language)
        queryClient.invalidateQueries()
      }}
      className="h-9 min-w-[260px] rounded-lg border bg-white px-3 text-sm"
    >
      <option value="">— Select HCP —</option>
      {hcpId && !ps.some((p) => p.hcp_id === hcpId) && <option value={hcpId}>{hcpId}</option>}
      {ps.map((p) => (
        <option key={p.hcp_id} value={p.hcp_id}>
          {p.name} · {p.label}
        </option>
      ))}
    </select>
  )
}
