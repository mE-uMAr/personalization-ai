import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { createBrowserRouter, Navigate, RouterProvider } from "react-router"
import { QueryClientProvider } from "@tanstack/react-query"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { DirectionProvider } from "@/components/ui/direction"
import { queryClient } from "@/lib/track"
import { useSession } from "@/lib/session"
import "./index.css"

import Launcher from "@/launcher/Launcher"
import SiteLayout from "@/site/SiteLayout"
import Home from "@/site/Home"
import Register from "@/site/Register"
import TaPage from "@/site/TaPage"
import ItemPage from "@/site/ItemPage"
import InfoPage from "@/site/InfoPage"

// Console and CRM views load on demand; the HCP site bundle stays small.
const lazy = (f: () => Promise<{ default: React.ComponentType }>) => async () => ({ Component: (await f()).default })

const router = createBrowserRouter([
  { path: "/", element: <Launcher /> },
  {
    path: "/site",
    element: <SiteLayout />,
    children: [
      { index: true, element: <Home /> },
      { path: "register", element: <Register /> },
      { path: "ta/:ta", element: <TaPage /> },
      { path: "item/:id", element: <ItemPage /> },
      { path: "info/:page", element: <InfoPage /> },
    ],
  },
  {
    path: "/console",
    lazy: lazy(() => import("@/console/ConsoleLayout")),
    children: [
      { index: true, lazy: lazy(() => import("@/console/Analytics")) },
      { path: "journey", lazy: lazy(() => import("@/console/LensPage")) },
      { path: "analytics", element: <Navigate to="/console" replace /> },
      { path: "clusters", lazy: lazy(() => import("@/console/Clusters")) },
      { path: "content", lazy: lazy(() => import("@/console/Content")) },
      { path: "inspector", lazy: lazy(() => import("@/console/Inspector")) },
      { path: "ab", lazy: lazy(() => import("@/console/AbResults")) },
    ],
  },
  { path: "/oce", lazy: lazy(() => import("@/oce/OceApp")) },
  { path: "*", element: <Navigate to="/" replace /> },
])

function Root() {
  const { lang } = useSession()
  return (
    <DirectionProvider dir={lang === "ar" ? "rtl" : "ltr"}>
      <TooltipProvider delayDuration={200}>
        <RouterProvider router={router} />
        <Toaster position="bottom-left" richColors closeButton />
      </TooltipProvider>
    </DirectionProvider>
  )
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <Root />
    </QueryClientProvider>
  </StrictMode>,
)
