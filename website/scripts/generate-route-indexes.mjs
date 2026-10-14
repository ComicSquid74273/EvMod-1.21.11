import fs from "node:fs/promises";
import path from "node:path";
const websiteDir = path.resolve(import.meta.dirname, "..");
const distDir = path.join(websiteDir, "dist");
const html = await Bun.file(path.join(distDir, "index.html")).text();
const toolPagesSource = await Bun.file(path.join(websiteDir, "src/lib/toolPages.ts")).text();
const routes = new Set(Array.from(toolPagesSource.matchAll(/path:\s*"([^"]+)"/g), ([, route]) => route).filter(route => route !== "/"));
if (!routes.size) throw new Error("No tool routes found while generating route index pages.");

for (const route of routes) {
  const rel = route.replace(/^\/+|\/+$/g, "");
  if (!rel) continue;
  const routeDir = path.join(distDir, rel);
  await fs.mkdir(routeDir, { recursive: true });
  await Bun.write(path.join(routeDir, "index.html"), html);
}

console.log(`Generated ${routes.size} route index page(s).`);