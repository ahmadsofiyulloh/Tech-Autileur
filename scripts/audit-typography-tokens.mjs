#!/usr/bin/env node

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();
const srcRoot = path.join(projectRoot, "src");
const globalsCssPath = path.join(srcRoot, "app", "globals.css");
const typographyProperties = new Set([
  "font-size",
  "line-height",
  "font-weight",
  "letter-spacing",
  "font-family",
  "font-feature-settings",
  "font-variant-numeric",
]);
const inlineStyleProperties = new Set(["fontSize", "lineHeight", "fontWeight", "letterSpacing", "fontFamily"]);
const sourceExtensions = new Set([".css", ".js", ".jsx", ".ts", ".tsx"]);

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const resolvedPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(resolvedPath)));
      continue;
    }

    if (sourceExtensions.has(path.extname(entry.name))) {
      files.push(resolvedPath);
    }
  }

  return files;
}

function collectViolations(text, filePath, properties) {
  const violations = [];
  const lines = text.split(/\r?\n/);

  for (const [index, line] of lines.entries()) {
    const trimmedLine = line.trim();

    for (const property of properties) {
      if (!trimmedLine.startsWith(`${property}:`)) {
        continue;
      }

      const value = trimmedLine.slice(property.length + 1).trim();
      if (value.startsWith("var(")) {
        continue;
      }

      violations.push({
        filePath,
        line: index + 1,
        match: trimmedLine,
      });
    }
  }

  return violations;
}

async function main() {
  const files = await walk(srcRoot);
  const violations = [];

  for (const filePath of files) {
    const text = await readFile(filePath, "utf8");

    if (filePath === globalsCssPath) {
      violations.push(...collectViolations(text, filePath, typographyProperties));
      continue;
    }

    violations.push(...collectViolations(text, filePath, inlineStyleProperties));
  }

  if (violations.length > 0) {
    console.error("Hardcoded typography audit failed.");
    for (const violation of violations) {
      console.error(`${path.relative(projectRoot, violation.filePath)}:${violation.line} -> ${violation.match}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log("Hardcoded typography audit passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
