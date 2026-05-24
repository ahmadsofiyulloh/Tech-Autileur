import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const CHANGELOG_PATH = path.join(ROOT, "docs", "CHANGELOG.md");
const START = "<!-- changelog:generated:start -->";
const END = "<!-- changelog:generated:end -->";

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

function refExists(ref) {
  return git(["rev-parse", "--verify", ref]) !== "";
}

function resolveRange() {
  if (process.env.CHANGELOG_RANGE) {
    return process.env.CHANGELOG_RANGE;
  }

  return refExists("origin/main") ? "origin/main..HEAD" : "HEAD~20..HEAD";
}

function groupedCommitLines(range) {
  const output = git(["log", range, "--reverse", "--date=short", "--pretty=format:%ad%x09%h%x09%s"]);

  if (!output) {
    return "Belum ada commit baru pada range ini.";
  }

  const groups = new Map();

  for (const line of output.split(/\r?\n/)) {
    const [date, hash, ...subjectParts] = line.split("\t");
    const subject = subjectParts.join("\t").trim().replace(/[^\x20-\x7E]/g, "-");

    if (!date || !hash || !subject) {
      continue;
    }

    const commits = groups.get(date) ?? [];
    commits.push(`- \`${hash}\` ${subject}`);
    groups.set(date, commits);
  }

  return Array.from(groups.entries())
    .map(([date, commits]) => `### ${date}\n\n${commits.join("\n")}`)
    .join("\n\n");
}

function replaceGeneratedBlock(content, block) {
  const startIndex = content.indexOf(START);
  const endIndex = content.indexOf(END);

  if (startIndex >= 0 && endIndex > startIndex) {
    return `${content.slice(0, startIndex)}${block}${content.slice(endIndex + END.length)}`;
  }

  const firstHeadingEnd = content.indexOf("\n");

  if (firstHeadingEnd >= 0) {
    return `${content.slice(0, firstHeadingEnd + 1)}\n${block}\n${content.slice(firstHeadingEnd + 1)}`;
  }

  return `${content}\n\n${block}\n`;
}

const range = resolveRange();
const generatedBlock = `${START}
## Riwayat commit aktual

Range: \`${range}\`

${groupedCommitLines(range)}
${END}`;

const current = fs.existsSync(CHANGELOG_PATH)
  ? fs.readFileSync(CHANGELOG_PATH, "utf8")
  : "# Changelog\n";
const next = replaceGeneratedBlock(current, generatedBlock);

fs.writeFileSync(CHANGELOG_PATH, next.endsWith("\n") ? next : `${next}\n`, "utf8");
console.log(`Updated ${path.relative(ROOT, CHANGELOG_PATH)} from ${range}`);
