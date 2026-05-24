import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const CHANGELOG_PATH = "docs/CHANGELOG.md";

function git(args, fallback = "") {
  try {
    return execFileSync("git", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return fallback;
  }
}

function refExists(ref) {
  return git(["rev-parse", "--verify", ref]) !== "";
}

function resolveGithubPushRange() {
  if (
    process.env.GITHUB_EVENT_NAME !== "push" ||
    !process.env.GITHUB_EVENT_PATH ||
    !existsSync(process.env.GITHUB_EVENT_PATH)
  ) {
    return "";
  }

  try {
    const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
    const before = typeof event.before === "string" ? event.before : "";
    const after = typeof event.after === "string" ? event.after : "HEAD";
    const zeroSha = /^0+$/;

    if (before && !zeroSha.test(before) && refExists(before)) {
      return `${before}..${after || "HEAD"}`;
    }
  } catch {
    return "";
  }

  return "";
}

function resolveRange() {
  if (process.env.CHANGELOG_CHECK_RANGE) {
    return process.env.CHANGELOG_CHECK_RANGE;
  }

  const githubPushRange = resolveGithubPushRange();
  if (githubPushRange) {
    return githubPushRange;
  }

  if (process.env.GITHUB_BASE_REF && refExists(`origin/${process.env.GITHUB_BASE_REF}`)) {
    return `origin/${process.env.GITHUB_BASE_REF}...HEAD`;
  }

  if (refExists("origin/main")) {
    return "origin/main...HEAD";
  }

  return "HEAD~1..HEAD";
}

function isSignificant(path) {
  if (!path || path === CHANGELOG_PATH) {
    return false;
  }

  return ![
    "public/release-meta.json",
  ].includes(path);
}

const range = resolveRange();
const output = git(["diff", "--name-only", range]);

if (!output) {
  console.log(`No changed files detected for ${range}.`);
  process.exit(0);
}

const changedFiles = output.split(/\r?\n/).filter(Boolean);
const needsChangelog = changedFiles.some(isSignificant);
const hasChangelog = changedFiles.includes(CHANGELOG_PATH);

if (needsChangelog && !hasChangelog) {
  console.error(`docs/CHANGELOG.md must be updated for changes in ${range}.`);
  console.error("Run npm run changelog:generate or add a dated manual entry.");
  process.exit(1);
}

console.log(`Changelog check passed for ${range}.`);
