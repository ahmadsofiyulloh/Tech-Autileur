#!/usr/bin/env node
// Quick TTFB probe across routes (no auth, redirects followed)
import { argv } from "node:process";

const ORIGIN = "https://www.banplex.my.id";
const PATHS = [
  "/dashboard",
  "/products",
  "/prompts",
  "/share",
  "/drive",
  "/settings",
  "/admin/diagnostics",
  "/products/new",
  "/login",
];

async function probe(path) {
  const url = `${ORIGIN}${path}`;
  const t0 = performance.now();
  let res, ttfbAtFirstByte;
  try {
    res = await fetch(url, { redirect: "manual" });
    ttfbAtFirstByte = performance.now() - t0;
    // drain body
    const buf = await res.arrayBuffer();
    return {
      path,
      status: res.status,
      finalUrl: res.headers.get("location") || url,
      ttfbMs: Math.round(ttfbAtFirstByte),
      totalMs: Math.round(performance.now() - t0),
      bytes: buf.byteLength,
    };
  } catch (err) {
    return { path, error: err.message };
  }
}

(async () => {
  console.log(`Probing ${ORIGIN} (no auth, redirect manual)\n`);
  for (const p of PATHS) {
    const r = await probe(p);
    console.log(JSON.stringify(r));
  }
})();
