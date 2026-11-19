// Event capture. Every event goes to the engine immediately; afterwards the HCP's
// recommendation queries are marked stale, so the next page view refetches —
// literally the "changes on next page view" requirement.
import { QueryClient } from "@tanstack/react-query"
import { api } from "./api"
import { DEVICE, SESSION_ID, session } from "./session"

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
  },
})

type Listener = (e: { event_type: string; item_id?: string; value?: string | number; result?: Awaited<ReturnType<typeof api.event>> }) => void
const listeners = new Set<Listener>()
export const onTracked = (l: Listener) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

// Events are sent one at a time, in order, so the profile sees them as they happened.
let queue: Promise<unknown> = Promise.resolve()

export function track(event_type: string, item_id?: string, value?: string | number) {
  const run = () => send(event_type, item_id, value)
  const p = queue.then(run, run)
  queue = p.catch(() => null)
  return p
}

async function send(event_type: string, item_id?: string, value?: string | number) {
  const { hcpId, lang } = session.get()
  if (!hcpId) return null // anonymous visitors: no personal tracking (no consent)
  try {
    // No tracking consent → nothing leaves the browser (the server would drop it anyway, §1)
    const hcp = await queryClient.fetchQuery({ queryKey: ["hcp", hcpId], queryFn: () => api.hcp(hcpId), staleTime: 60_000 })
    if (!hcp.tracking_consent) return null
    const result = await api.event({
      hcp_id: hcpId, item_id, event_type, value: value ?? null, session_id: SESSION_ID, device: DEVICE, language: lang,
    })
    queryClient.invalidateQueries({ queryKey: ["recs", hcpId] })
    queryClient.invalidateQueries({ queryKey: ["lens", hcpId] })
    listeners.forEach((l) => l({ event_type, item_id, value, result }))
    return result
  } catch {
    return null // tracking must never break the page
  }
}
