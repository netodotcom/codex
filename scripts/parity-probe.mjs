// Parity probe — the executable spec for the Vite cutover (Backlog 1.1).
//
// Boots a CODEX URL in headless Chrome and captures a *signature*: app version,
// whether #root mounted, and the typeof a set of boot-critical globals. The
// legacy app's signature is the golden; later the Vite-served app must match it.
//
// Cross-OS (the repo's smoke-*.mjs hardcode a macOS Chrome path; this one
// detects Chrome on win/mac/linux, or honors CHROME_PATH / PUPPETEER_EXECUTABLE_PATH).
//
// Usage:
//   node scripts/parity-probe.mjs --capture            # write golden from URL
//   node scripts/parity-probe.mjs                      # compare URL to golden
//   node scripts/parity-probe.mjs --url http://127.0.0.1:7777
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer-core");

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const GOLDEN = join(ROOT, "scripts", "parity.golden.json");

const args = process.argv.slice(2);
const capture = args.includes("--capture") || args.includes("--update");
const urlIdx = args.indexOf("--url");
const URL = urlIdx >= 0 ? args[urlIdx + 1] : "http://127.0.0.1:7777";

// Boot-critical globals the app exposes; their presence is the contract a
// Vite boot must preserve. (typeof, so we don't serialize the values.)
const GLOBALS = [
  "BIBLE",
  "CODEX_DATA",
  "CODEX_GEMATRIA",
  "CODEX_GEMATRIA_INDEX",
  "CODEX_SEARCH",
  "CODEX_MODULES",
  "CODEX_PLUGINS_API",
  "OracleX",
  "LibraryX",
  "t",
  "codexJumpToRef",
];

function findChrome() {
  const env = process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_PATH;
  if (env && existsSync(env)) return env;
  const byPlatform = {
    win32: [
      "C:/Program Files/Google/Chrome/Application/chrome.exe",
      "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
      join(process.env.LOCALAPPDATA || "", "Google/Chrome/Application/chrome.exe"),
    ],
    darwin: ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"],
    linux: ["/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"],
  };
  for (const c of byPlatform[process.platform] || []) if (c && existsSync(c)) return c;
  return null;
}

const noisy = (s) => /Access-Control-Allow-Origin|CORS|net::ERR|favicon|Failed to load resource|ERR_/i.test(s);

async function probe() {
  const chrome = findChrome();
  if (!chrome) {
    console.error("[parity] Chrome not found. Set CHROME_PATH or PUPPETEER_EXECUTABLE_PATH.");
    process.exit(2);
  }
  const consoleErrors = [];
  const pageErrors = [];
  const browser = await puppeteer.launch({
    executablePath: chrome,
    headless: "new",
    args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
  });
  try {
    const page = await browser.newPage();
    page.on("console", (m) => {
      if (m.type() === "error") consoleErrors.push(m.text());
    });
    page.on("pageerror", (e) => pageErrors.push(String(e)));

    await page.goto(URL, { waitUntil: "networkidle2", timeout: 30000 });
    await page.waitForFunction(
      () => !!(window.CODEX_DATA && document.getElementById("root") && document.getElementById("root").children.length > 0),
      { timeout: 20000 },
    );

    const sig = await page.evaluate((globals) => {
      const typeofs = {};
      for (const g of globals) typeofs[g] = typeof window[g];
      const root = document.getElementById("root");
      return {
        version: (window.CODEX_VERSION && window.CODEX_VERSION.v) || null,
        rootMounted: !!(root && root.children.length > 0),
        globals: typeofs,
      };
    }, GLOBALS);

    const realErrors = [...consoleErrors, ...pageErrors].filter((s) => !noisy(s));
    await browser.close();
    return { sig, realErrors };
  } catch (e) {
    await browser.close();
    console.error("[parity] probe error:", e.message);
    process.exit(2);
  }
}

const { sig, realErrors } = await probe();

if (capture) {
  writeFileSync(GOLDEN, JSON.stringify(sig, null, 2) + "\n");
  console.log("[parity] golden captured from", URL);
  console.log(JSON.stringify(sig, null, 2));
  if (realErrors.length) console.warn("[parity] WARN: console/page errors at capture:", realErrors.slice(0, 5));
  process.exit(0);
}

if (!existsSync(GOLDEN)) {
  console.error("[parity] no golden yet — run with --capture against the legacy app first.");
  process.exit(2);
}
const golden = JSON.parse(readFileSync(GOLDEN, "utf8"));
const diffs = [];
if (sig.version !== golden.version) diffs.push(`version: ${golden.version} → ${sig.version}`);
if (sig.rootMounted !== golden.rootMounted) diffs.push(`rootMounted: ${golden.rootMounted} → ${sig.rootMounted}`);
for (const g of GLOBALS) {
  if (sig.globals[g] !== golden.globals[g]) diffs.push(`global ${g}: ${golden.globals[g]} → ${sig.globals[g]}`);
}
if (realErrors.length) diffs.push(`console/page errors: ${realErrors.length} (${realErrors.slice(0, 3).join(" | ")})`);

if (diffs.length) {
  console.error("[parity] FAIL — signature drift vs golden:");
  for (const d of diffs) console.error("  ✗ " + d);
  process.exit(1);
}
console.log("[parity] PASS — matches golden (" + URL + ")");
process.exit(0);
