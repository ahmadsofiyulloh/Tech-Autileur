import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DEV_REF = "czpjccljowyldtvycxlq";
const PROD_REF = "laychawloumnhvzgegmj";
const EXPECTED_REFS = new Set([DEV_REF, PROD_REF]);

const checks = [];

function addCheck(status, label, detail) {
  checks.push({ status, label, detail });
}

function readText(relativePath) {
  const filePath = path.join(ROOT, relativePath);
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : null;
}

function extractSupabaseRefFromUrl(value) {
  const match = value?.match(/https:\/\/([a-z0-9-]+)\.supabase\.co/i);
  return match?.[1] ?? null;
}

function extractQueryParam(url, param) {
  try {
    return new URL(url).searchParams.get(param);
  } catch {
    return null;
  }
}

function readEnvValue(relativePath, name) {
  const content = readText(relativePath);
  if (!content) return null;

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [rawName, ...rest] = trimmed.split("=");
    if (rawName !== name) continue;
    return rest.join("=").trim().replace(/^["']|["']$/g, "");
  }

  return null;
}

function checkMcpJson() {
  const content = readText(".mcp.json");
  if (!content) {
    addCheck("FAIL", ".mcp.json", "missing");
    return;
  }

  if (/token|secret|authorization|bearer/i.test(content)) {
    addCheck("FAIL", ".mcp.json", "contains a token/secret-like key");
  }

  let json;
  try {
    json = JSON.parse(content);
  } catch (error) {
    addCheck("FAIL", ".mcp.json", `invalid JSON: ${error.message}`);
    return;
  }

  const devUrl = json?.mcpServers?.supabase_dev?.url;
  const prodUrl = json?.mcpServers?.supabase_prod_readonly?.url;

  const devRef = extractQueryParam(devUrl, "project_ref");
  const devFeatures = extractQueryParam(devUrl, "features") ?? "";
  if (devRef === DEV_REF && devFeatures.includes("database") && devFeatures.includes("docs")) {
    addCheck("PASS", "MCP dev", `project_ref=${devRef}`);
  } else {
    addCheck("FAIL", "MCP dev", "must use dev project_ref and database,docs features");
  }

  const prodRef = extractQueryParam(prodUrl, "project_ref");
  const prodReadOnly = extractQueryParam(prodUrl, "read_only");
  const prodFeatures = extractQueryParam(prodUrl, "features") ?? "";
  if (
    prodRef === PROD_REF &&
    prodReadOnly === "true" &&
    prodFeatures.includes("database") &&
    prodFeatures.includes("docs")
  ) {
    addCheck("PASS", "MCP production", `project_ref=${prodRef}, read_only=true`);
  } else {
    addCheck("FAIL", "MCP production", "must use production project_ref, read_only=true, and database,docs features");
  }
}

function checkEnvRefs() {
  const localRef = extractSupabaseRefFromUrl(readEnvValue(".env.local", "NEXT_PUBLIC_SUPABASE_URL"));
  if (localRef === DEV_REF) {
    addCheck("PASS", ".env.local", `NEXT_PUBLIC_SUPABASE_URL ref=${localRef}`);
  } else {
    addCheck("FAIL", ".env.local", `expected dev ref ${DEV_REF}, got ${localRef ?? "missing"}`);
  }

  const productionRef = extractSupabaseRefFromUrl(
    readEnvValue(".env.production.sync", "NEXT_PUBLIC_SUPABASE_URL"),
  );
  if (productionRef === PROD_REF) {
    addCheck("PASS", ".env.production.sync", `NEXT_PUBLIC_SUPABASE_URL ref=${productionRef}`);
  } else {
    addCheck("FAIL", ".env.production.sync", `expected production ref ${PROD_REF}, got ${productionRef ?? "missing"}`);
  }
}

function checkCliLink() {
  const linkedRef = readText("supabase/.temp/project-ref")?.trim();
  if (!linkedRef) {
    addCheck("WARN", "Supabase CLI link", "not linked; use explicit --db-url or supabase link before CLI migration");
    return;
  }

  if (!EXPECTED_REFS.has(linkedRef)) {
    addCheck("FAIL", "Supabase CLI link", `points to unexpected project_ref=${linkedRef}`);
    return;
  }

  const label = linkedRef === PROD_REF ? "production" : "dev";
  addCheck("WARN", "Supabase CLI link", `currently linked to ${label} (${linkedRef}); verify before db push`);
}

function checkGlobalMcp() {
  const codexHome = process.env.CODEX_HOME || path.join(process.env.USERPROFILE ?? "", ".codex");
  const activeConfigPath = path.join(codexHome, "config.toml");

  if (!fs.existsSync(activeConfigPath)) {
    addCheck("WARN", "Active Codex MCP", `no config.toml found at ${activeConfigPath}`);
    return;
  }

  const lines = fs.readFileSync(activeConfigPath, "utf8").split(/\r?\n/);
  const servers = new Map();
  let currentServer = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const serverMatch = trimmed.match(/^\[mcp_servers\.([A-Za-z0-9_-]+)\]$/);
    if (serverMatch) {
      currentServer = serverMatch[1];
      servers.set(currentServer, { url: null });
      continue;
    }

    if (/^\[.+\]$/.test(trimmed)) {
      currentServer = null;
      continue;
    }

    if (currentServer) {
      const urlMatch = trimmed.match(/^url\s*=\s*"([^"]+)"/);
      if (urlMatch) servers.get(currentServer).url = urlMatch[1];
    }
  }

  if (servers.has("supabase")) {
    const projectRef = extractQueryParam(servers.get("supabase").url, "project_ref") ?? "missing";
    addCheck("FAIL", "Active Codex MCP", `active generic supabase server points to project_ref=${projectRef}`);
  } else {
    addCheck("PASS", "Active Codex MCP", `no active generic supabase server in ${activeConfigPath}`);
  }

  const devServer = servers.get("supabase_dev") ?? servers.get("supabase_tech_autiluer_dev");
  const prodServer = servers.get("supabase_prod_readonly") ?? servers.get("supabase_tech_autiluer_prod_readonly");
  const devRef = extractQueryParam(devServer?.url, "project_ref");
  const prodRef = extractQueryParam(prodServer?.url, "project_ref");
  const prodReadOnly = extractQueryParam(prodServer?.url, "read_only");

  if (devRef === DEV_REF) {
    addCheck("PASS", "Active MCP dev fallback", `project_ref=${devRef}`);
  } else {
    addCheck("WARN", "Active MCP dev fallback", `explicit dev server missing or not scoped to ${DEV_REF}`);
  }

  if (prodRef === PROD_REF && prodReadOnly === "true") {
    addCheck("PASS", "Active MCP production fallback", `project_ref=${prodRef}, read_only=true`);
  } else {
    addCheck(
      "WARN",
      "Active MCP production fallback",
      `explicit production readonly server missing or not scoped to ${PROD_REF}`,
    );
  }
}

function printResults() {
  console.log("Supabase target guard");
  console.log(`dev=${DEV_REF}`);
  console.log(`production=${PROD_REF}`);
  console.log("");

  for (const check of checks) {
    console.log(`[${check.status}] ${check.label}: ${check.detail}`);
  }

  const failures = checks.filter((check) => check.status === "FAIL");
  if (failures.length > 0) {
    console.error("");
    console.error(`Target guard failed with ${failures.length} issue(s).`);
    process.exitCode = 1;
  }
}

checkMcpJson();
checkEnvRefs();
checkCliLink();
checkGlobalMcp();
printResults();
