// Screenshots every page in the built site as its 1200×630 share image,
// saved to _site/assets/og/<page-path>.png (named the way the ogImage filter expects).
// Run after `npm run build`. Uses CHROME_PATH, or a system Chrome.
import { createServer } from "node:http";
import { readFile, mkdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const run = promisify(execFile);
const SITE_DIR = path.resolve("_site");
const OUT_DIR = path.join(SITE_DIR, "assets/og");
const PORT = 8799;

const chrome =
  process.env.CHROME_PATH ||
  [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
  ].find(existsSync);
if (!chrome) throw new Error("No Chrome found; set CHROME_PATH");

const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".xml": "application/xml" };
const server = createServer(async (req, res) => {
  let file = path.join(SITE_DIR, decodeURIComponent(new URL(req.url, "http://x").pathname));
  try {
    if ((await stat(file)).isDirectory()) file = path.join(file, "index.html");
    res.writeHead(200, { "content-type": types[path.extname(file)] || "application/octet-stream" });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(PORT, resolve));

const sitemap = await readFile(path.join(SITE_DIR, "sitemap.xml"), "utf8");
const routes = [...sitemap.matchAll(/<loc>https?:\/\/[^/]+(\/[^<]*)<\/loc>/g)].map((m) => m[1]);
await mkdir(OUT_DIR, { recursive: true });

for (const route of routes) {
  const name = route === "/" ? "home" : route.replace(/^\/|\/$/g, "").replace(/\//g, "-");
  const out = path.join(OUT_DIR, `${name}.png`);
  await run(chrome, [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    ...(process.env.CI ? ["--no-sandbox"] : []),
    "--force-device-scale-factor=1",
    "--window-size=1200,630",
    "--virtual-time-budget=8000",
    `--screenshot=${out}`,
    `http://localhost:${PORT}${route}?og`,
  ]);
  console.log(`og  ${route} → assets/og/${name}.png`);
}

server.close();
