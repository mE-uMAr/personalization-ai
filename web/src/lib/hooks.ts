import { useQuery } from "@tanstack/react-query"
import { api } from "./api"
import { SESSION_ID, useSession } from "./session"

export function useConfig() {
  return useQuery({ queryKey: ["config"], queryFn: api.config, staleTime: 60_000 }).data
}

export function useHcp() {
  const { hcpId } = useSession()
  return useQuery({ queryKey: ["hcp", hcpId], queryFn: () => api.hcp(hcpId!), enabled: !!hcpId, retry: false })
}

// All recommendation queries share the ["recs", hcpId] prefix → one invalidation after an event.
export function useHome() {
  const { hcpId, lang, anonCountry } = useSession()
  return useQuery({
    queryKey: ["recs", hcpId, "home", lang, anonCountry],
    queryFn: () => api.home({ hcp_id: hcpId, lang, session_id: SESSION_ID, country: hcpId ? undefined : anonCountry }),
    staleTime: 0,
  })
}

export function useTaPage(ta: string) {
  const { hcpId, lang, anonCountry } = useSession()
  return useQuery({
    queryKey: ["recs", hcpId, "ta", ta, lang, anonCountry],
    queryFn: () => api.ta(ta, { hcp_id: hcpId, lang, session_id: SESSION_ID, country: hcpId ? undefined : anonCountry }),
    staleTime: 0,
  })
}

export function useItem(id: string) {
  const { hcpId, lang, anonCountry } = useSession()
  return useQuery({
    queryKey: ["recs", hcpId, "item", id, lang, anonCountry],
    queryFn: () => api.item(id, { hcp_id: hcpId, lang, session_id: SESSION_ID, country: hcpId ? undefined : anonCountry }),
    staleTime: Infinity, // the item page itself is stable while open; the "next" row refreshes on revisit
    retry: false,
  })
}

export function useLens(hcpId: string | null, enabled = true) {
  const { lang } = useSession()
  return useQuery({
    queryKey: ["lens", hcpId, lang],
    queryFn: () => api.lens(hcpId!, lang),
    enabled: !!hcpId && enabled,
    refetchInterval: 2000, // polling every 2 s survives venue Wi-Fi and proxies
    staleTime: 0,
  })
}

export function useDemoState() {
  return useQuery({ queryKey: ["demo"], queryFn: api.demoState, refetchInterval: 4000 })
}
