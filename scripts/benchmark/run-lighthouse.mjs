#!/usr/bin/env node
// Benchmark all main pages on production with authenticated session.
// Usage: node scripts/benchmark/run-lighthouse.mjs
// Reads creds from .env.benchmark.local
//
// Output: scripts/benchmark/results/<timestamp>/
//   - <page>.report.html  (Lighthouse HTML)
//   - <page>.report.json  (Lighthouse JSON)
//   - summary.json        (extracted metrics for all pages)
//   - summary.md          (human-readable table)

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import puppeteer from "puppeteer";
import lighthouse from "lighthouse";

const ENV_FILE = ".env.benchmark.local";

async function loadEnv() {
  const raw = await readFile(ENV_FILE, "utf8");
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

const PAGES = [
  { name: "01-dashboard", path: "/dashboard" },
  { name: "02-products", path: "/products" },
  { name: "03-prompts", path: "/prompts" },
  { name: "04-share", path: "/share" },
  { name: "05-drive", path: "/drive" },
  { name: "06-settings", path: "/settings" },
  { name: "07-admin-diagnostics", path: "/admin/diagnostics" },
  { name: "08-products-new", path: "/products/new" },
  { name: "09-login", path: "/login" },
  { name: "10-tools-ai-media", path: "/tools/ai-media" },
];

async function login(browser, origin, email, password) {
  const page = await browser.newPage();
  await page.goto(`${origin}/login`, { waitUntil: "networkidle2", timeout: 60000 });

  // Try common selectors. The form uses native input[type=email] + input[type=password]
  await page.waitForSelector('input[type="email"]', { timeout: 15000 });
  await page.type('input[type="email"]', email, { delay: 30 });
  await page.type('input[type="password"]', password, { delay: 30 });
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle2", timeout: 60000 }),
    page.click('button[type="submit"]'),
  ]);
  await page.close();
}

async function benchmarkPage(browser, origin, name, path, outDir) {
  const url = `${origin}${path}`;
  console.log(`[${name}] benchmarking ${url}`);

  // Lighthouse uses browser.wsEndpoint() to attach. We pass an existing browser
  // so the auth cookies persist.
  const port = new URL(browser.wsEndpoint()).port;

  const result = await lighthouse(
    url,
    {
      port,
      output: ["html", "json"],
      logLevel: "error",
      onlyCategories: ["performance"],
      // emulate desktop with throttling for repeatable numbers
      formFactor: "desktop",
      screenEmulation: {
        mobile: false,
        width: 1366,
        height: 768,
        deviceScaleFactor: 1,
        disabled: false,
      },
      throttling: {
        rttMs: 40,
        throughputKbps: 10240,
        cpuSlowdownMultiplier: 1,
        requestLatencyMs: 0,
        downloadThroughputKbps: 0,
        uploadThroughputKbps: 0,
      },
    },
  );

  const lhr = result.lhr;
  const html = result.report[0];
  const json = result.report[1];

  await writeFile(join(outDir, `${name}.report.html`), html);
  await writeFile(join(outDir, `${name}.report.json`), json);

  const a = lhr.audits;
  return {
    name,
    path,
    finalUrl: lhr.finalDisplayedUrl,
    score: Math.round((lhr.categories.performance.score ?? 0) * 100),
    fcp: a["first-contentful-paint"].numericValue,
    lcp: a["largest-contentful-paint"].numericValue,
    tbt: a["total-blocking-time"].numericValue,
    cls: a["cumulative-layout-shift"].numericValue,
    si: a["speed-index"].numericValue,
    tti: a["interactive"]?.numericValue,
    ttfb: a["server-response-time"]?.numericValue,
    bootupMs: a["bootup-time"]?.numericValue,
    mainThreadMs: a["mainthread-work-breakdown"]?.numericValue,
    transferKb: Math.round((a["network-requests"]?.details?.items ?? []).reduce((s, r) => s + (r.transferSize || 0), 0) / 1024),
    requestCount: (a["network-requests"]?.details?.items ?? []).length,
    domNodes: a["dom-size"]?.numericValue,
    unusedJsKb: Math.round((a["unused-javascript"]?.details?.overallSavingsBytes ?? 0) / 1024),
    unusedCssKb: Math.round((a["unused-css-rules"]?.details?.overallSavingsBytes ?? 0) / 1024),
  };
}

function fmt(ms) {
  return typeof ms === "number" ? `${Math.round(ms)}` : "-";
}

async function writeSummary(outDir, results, meta) {
  await writeFile(join(outDir, "summary.json"), JSON.stringify({ meta, results }, null, 2));

  const lines = [
    `# Lighthouse Benchmark — ${meta.timestamp}`,
    ``,
    `Origin: ${meta.origin}`,
    `Form factor: desktop / RTT 40ms / 10Mbps / cpu 1x`,
    ``,
    `| # | Page | Score | LCP | FCP | TBT | CLS | SI | TTFB | Transfer | Reqs | UnusedJS | UnusedCSS |`,
    `|---|------|------:|----:|----:|----:|----:|---:|-----:|---------:|-----:|---------:|----------:|`,
  ];
  for (const r of results) {
    lines.push(
      `| ${r.name} | \`${r.path}\` | **${r.score}** | ${fmt(r.lcp)}ms | ${fmt(r.fcp)}ms | ${fmt(r.tbt)}ms | ${(r.cls ?? 0).toFixed(3)} | ${fmt(r.si)}ms | ${fmt(r.ttfb)}ms | ${r.transferKb}KB | ${r.requestCount} | ${r.unusedJsKb}KB | ${r.unusedCssKb}KB |`,
    );
  }
  await writeFile(join(outDir, "summary.md"), lines.join("\n"));
}

async function main() {
  const env = await loadEnv();
  const origin = env.PROD_URL?.startsWith("http") ? env.PROD_URL : `https://${env.PROD_URL}`;
  const cleanOrigin = origin.replace(/\/$/, "");
  const email = env.PROD_OWNER_EMAIL;
  const password = env.PROD_OWNER_PASSWORD;
  if (!cleanOrigin || !email || !password) {
    throw new Error("Missing PROD_URL/PROD_OWNER_EMAIL/PROD_OWNER_PASSWORD");
  }

  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outDir = `scripts/benchmark/results/${ts}`;
  if (!existsSync(outDir)) await mkdir(outDir, { recursive: true });

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    console.log(`Logging in as ${email}`);
    await login(browser, cleanOrigin, email, password);

    const results = [];
    for (const page of PAGES) {
      try {
        const r = await benchmarkPage(browser, cleanOrigin, page.name, page.path, outDir);
        results.push(r);
        console.log(`  -> score=${r.score} LCP=${Math.round(r.lcp)}ms TBT=${Math.round(r.tbt)}ms transfer=${r.transferKb}KB`);
      } catch (err) {
        console.error(`  -> FAILED: ${err.message}`);
        results.push({ name: page.name, path: page.path, error: err.message });
      }
    }

    await writeSummary(outDir, results, {
      timestamp: ts,
      origin: cleanOrigin,
      formFactor: "desktop",
      throttling: "RTT 40ms, 10Mbps, cpu 1x",
    });

    console.log(`\nDone. Results: ${outDir}`);
    console.log(`Summary: ${outDir}/summary.md`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
