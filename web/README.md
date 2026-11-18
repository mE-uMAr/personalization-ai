# Web (HCP site, engine console, mock CRM, demo launcher)

React 19 + Vite + Tailwind + shadcn/ui (RTL-ready). Talks to the API at `/api/v1` and loads media from `/media`.

```
npm ci
npm run dev        # http://localhost:5173 (proxies /api and /media to http://127.0.0.1:8000)
npm run build      # static build in dist/
```

Routes: `/` launcher · `/site` HCP site · `/console` engine console · `/oce` mock CRM rep view.
