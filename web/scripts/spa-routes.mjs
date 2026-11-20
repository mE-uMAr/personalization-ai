// Static hosting without rewrites: give every client-side route its own copy of index.html, so a deep link
// or a page refresh (e.g. /site/item/CMD-002, /console/content) loads the app instead of a 404.
// Item and therapy-area ids come from the API's data files, so new content is covered on the next build.
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const web = join(dirname(fileURLToPath(import.meta.url)), "..")
const dist = join(web, "dist")
const data = join(web, "..", "api", "data")
const read = (f) => JSON.parse(readFileSync(join(data, f), "utf8"))

const items = read("catalogue.json").items.map((i) => i.item_id)
const tas = read("config.json").therapy_areas.map((t) => t.id)
const routes = [
  "site", "site/register",
  ...tas.map((t) => `site/ta/${t}`),
  ...items.map((i) => `site/item/${i}`),
  ...["about", "side-effects", "contact", "terms", "privacy"].map((p) => `site/info/${p}`),
  "console", "console/journey", "console/analytics", "console/clusters", "console/content", "console/inspector", "console/ab",
  "oce",
]

const index = join(dist, "index.html")
if (!existsSync(index)) throw new Error("dist/index.html missing: run vite build first")
for (const r of routes) {
  const dir = join(dist, r)
  mkdirSync(dir, { recursive: true })
  copyFileSync(index, join(dir, "index.html"))
}
console.log(`spa-routes: ${routes.length} routes`)
