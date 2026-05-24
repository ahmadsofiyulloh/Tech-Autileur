import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import packageJson from "../package.json" with { type: "json" };

const ROOT = process.cwd();
const OUTPUT_PATH = path.join(ROOT, "public", "release-meta.json");

function git(args, fallback = "") {
  try {
    return execFileSync("git", args, {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return fallback;
  }
}

function positiveInt(value) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function packageBuildNumber(version) {
  const [core, preRelease = "0"] = String(version).split("-");
  const [year = "0000", month = "00", day = "00"] = core.split(".");
  const buildNumber = preRelease.split(".")[0] || "0";

  return `${year}.${month.padStart(2, "0")}.${day.padStart(2, "0")}.${buildNumber}`;
}

const commitSha = process.env.GITHUB_SHA || process.env.VERCEL_GIT_COMMIT_SHA || git(["rev-parse", "HEAD"]);
const commitShortSha = commitSha ? commitSha.slice(0, 7) : git(["rev-parse", "--short", "HEAD"]);
const commitDateIso = git(["log", "-1", "--format=%cI"], new Date().toISOString());
const releaseDate = commitDateIso.slice(0, 10);
const releaseDateTimePrefix = `${releaseDate}T00:00:00Z`;
const dailyCommitCount =
  positiveInt(git(["rev-list", "--count", `--since=${releaseDateTimePrefix}`, "HEAD"])) ??
  positiveInt(process.env.GITHUB_RUN_NUMBER) ??
  1;
const buildNumber =
  process.env.APP_RELEASE_BUILD_NUMBER ||
  `${releaseDate.replaceAll("-", ".")}.${dailyCommitCount}`;
const branch =
  process.env.GITHUB_REF_NAME ||
  process.env.VERCEL_GIT_COMMIT_REF ||
  git(["rev-parse", "--abbrev-ref", "HEAD"], "");
const source = process.env.GITHUB_ACTIONS === "true"
  ? "github-actions"
  : process.env.VERCEL === "1"
    ? "vercel"
    : commitSha
      ? "local-git"
      : "package";

const releaseMeta = {
  appName: "Banplex OS",
  branch,
  buildNumber: buildNumber || packageBuildNumber(packageJson.version),
  commitSha,
  commitShortSha,
  generatedAt: new Date().toISOString(),
  packageVersion: packageJson.version,
  releaseDate,
  source,
};

fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(releaseMeta, null, 2)}\n`, "utf8");
console.log(`Wrote ${path.relative(ROOT, OUTPUT_PATH)} (${releaseMeta.buildNumber})`);
