import { useAdmin } from "@/lib/admin-i18n"
import { useDemoState } from "@/lib/hooks"
import { session, useSession } from "@/lib/session"
import { queryClient } from "@/lib/track"
import { AdminSelect } from "./ConsoleLayout"

export function HcpPicker() {
  const { L } = useAdmin()
  const { hcpId } = useSession()
  const demo = useDemoState()
  const ps = demo.data?.personas ?? []
  return (
    <AdminSelect
      label={L("HCP", "الطبيب")}
      value={hcpId ?? ""}
      onChange={(v) => {
        const p = ps.find((x) => x.hcp_id === v)
        session.setHcp(v || null, p?.language)
        queryClient.invalidateQueries()
      }}
      className="min-w-[280px]"
    >
      <option value="">{L("Choose an HCP…", "اختر طبيباً…")}</option>
      {hcpId && !ps.some((p) => p.hcp_id === hcpId) && <option value={hcpId}>{L("Live HCP (registered in this session)", "طبيب مسجّل في هذه الجلسة")}</option>}
      {ps.map((p) => (
        <option key={p.hcp_id} value={p.hcp_id}>
          {p.name} · {p.label}
        </option>
      ))}
    </AdminSelect>
  )
}
