/**
 * Xiima Snap Engine — Puppeteer screenshot + RedimensionAI optimization
 *
 * Captures the dashboard at localhost:3000, waits for Framer Motion
 * animations to complete, then sends the screenshot to the RedimensionAI
 * microservice for multi-format optimization (16:9 LinkedIn, 4:5 TikTok).
 *
 * Usage:
 *   node snap_engine.js [--url http://localhost:3000] [--out ./snapshots]
 */
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const FormData = require("form-data");
const fetch = require("node-fetch");

// Load configuration
const config = require('./config');

// ─────────────────────────────────────────────
// Config (override via env or CLI args)
// ─────────────────────────────────────────────
const args = process.argv.slice(2).reduce((acc, arg, i, arr) => {
  if (arg.startsWith("--")) acc[arg.slice(2)] = arr[i + 1];
  return acc;
}, {});

const DASHBOARD_URL = args.url || config.dashboard.url;
const OUTPUT_DIR = args.out || config.output.directory;
const REDIMENSION_URL = config.redimensionAI.url;
const EXPORT_FORMATS = config.redimensionAI.formats;

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

/**
 * Wait for Framer Motion animations to finish.
 * Strategy: poll until no elements with transform transitions are mid-flight,
 * or fall back to a fixed delay.
 */
async function waitForAnimations(page, maxWaitMs = config.dashboard.animationWait) {
  try {
    await page.waitForFunction(
      () => {
        const animated = document.querySelectorAll("[style*='transform']");
        return animated.length === 0 || Array.from(animated).every((el) => {
          const style = window.getComputedStyle(el);
          return style.getPropertyValue("animation-play-state") !== "running";
        });
      },
      { timeout: maxWaitMs }
    );
  } catch {
    // Fallback: just wait a fixed time
    await new Promise((r) => setTimeout(r, maxWaitMs));
  }
}

// ─────────────────────────────────────────────
// Screenshot
// ─────────────────────────────────────────────
async function captureScreenshot() {
  console.log(`[snap] Launching browser → ${DASHBOARD_URL}`);

  const browser = await puppeteer.launch({
    headless: config.browser.headless,
    args: config.browser.args,
  });

  const page = await browser.newPage();
  await page.setViewport(config.dashboard.viewport);

  // Suppress console noise from the page
  page.on("console", () => {});

  await page.goto(DASHBOARD_URL, { waitUntil: "networkidle2", timeout: config.dashboard.timeout });

  // Wait for Framer Motion entrance animations (staggerChildren: 0.1, delayChildren: 0.2)
  await page.waitForTimeout(800);
  await waitForAnimations(page, config.dashboard.animationWait);

  const ts = timestamp();
  const screenshotPath = path.join(OUTPUT_DIR, `${config.output.filenamePrefix}-${ts}.png`);
  ensureDir(OUTPUT_DIR);

  await page.screenshot({ path: screenshotPath, fullPage: false, type: "png" });
  console.log(`[snap] Screenshot saved → ${screenshotPath}`);

  await browser.close();
  return screenshotPath;
}

// ─────────────────────────────────────────────
// RedimensionAI integration
// ─────────────────────────────────────────────
async function sendToRedimensionAI(imagePath, format) {
  const endpoint = `${REDIMENSION_URL}/resize`;

  const form = new FormData();
  form.append("image", fs.createReadStream(imagePath));
  form.append("width", String(format.width));
  form.append("height", String(format.height));
  form.append("platform", format.platform);
  form.append("smart_crop", "true");

  console.log(`[snap] Sending to RedimensionAI → ${format.name} (${format.width}×${format.height})`);

  const res = await fetch(endpoint, { method: "POST", body: form });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`RedimensionAI error ${res.status}: ${err}`);
  }

  // Expect binary image back
  const buffer = await res.buffer();
  const outPath = path.join(OUTPUT_DIR, `${config.output.filenamePrefix}-${format.name}-${path.basename(imagePath)}`);
  fs.writeFileSync(outPath, buffer);
  console.log(`[snap] ✅ Optimized saved → ${outPath}`);
  return outPath;
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────
async function main() {
  console.log("[snap] Xiima Snap Engine starting...");

  const screenshotPath = await captureScreenshot();

  // Send to RedimensionAI for each export format
  const results = [];
  for (const fmt of EXPORT_FORMATS) {
    try {
      const optimized = await sendToRedimensionAI(screenshotPath, fmt);
      results.push({ format: fmt.name, path: optimized, status: "ok" });
    } catch (err) {
      console.error(`[snap] ❌ Failed for ${fmt.name}: ${err.message}`);
      results.push({ format: fmt.name, error: err.message, status: "error" });
    }
  }

  console.log("\n[snap] Summary:");
  results.forEach((r) => console.log(`  ${r.status === "ok" ? "✅" : "❌"} ${r.format}: ${r.path || r.error}`));

  return results;
}

main().catch((err) => {
  console.error("[snap] Fatal:", err);
  process.exit(1);
});