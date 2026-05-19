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
const cssDeclarationPattern = new RegExp(
  `(?<![-\\w])(${Array.from(typographyProperties).join("|")})\\s*:\\s*([^;{}]+)`,
  "g",
);
const inlineStylePattern = new RegExp(
  `\\b(${Array.from(inlineStyleProperties).join("|")})\\s*:\\s*([^,}\\n]+)`,
  "g",
);

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

function getLineAndColumn(text, index) {
  const beforeMatch = text.slice(0, index);
  const lines = beforeMatch.split(/\r?\n/);

  return {
    line: lines.length,
    column: lines.at(-1).length + 1,
  };
}

function collectCssBlockRanges(text, selectorPattern) {
  const ranges = [];
  let match;

  selectorPattern.lastIndex = 0;

  while ((match = selectorPattern.exec(text)) !== null) {
    let braceDepth = 0;

    for (let index = match.index; index < text.length; index += 1) {
      const char = text[index];

      if (char === "{") {
        braceDepth += 1;
        continue;
      }

      if (char === "}") {
        braceDepth -= 1;

        if (braceDepth === 0) {
          ranges.push([match.index, index + 1]);
          selectorPattern.lastIndex = index + 1;
          break;
        }
      }
    }
  }

  return ranges;
}

function isInsideRange(index, ranges) {
  return ranges.some(([start, end]) => index >= start && index < end);
}

function normalizeValue(value) {
  return value.trim().replace(/^["'`]|["'`]$/g, "");
}

function isTokenValue(value) {
  return normalizeValue(value).startsWith("var(");
}

function collectCssViolations(text, filePath, allowedRanges = []) {
  const violations = [];

  cssDeclarationPattern.lastIndex = 0;

  for (const match of text.matchAll(cssDeclarationPattern)) {
    if (isInsideRange(match.index, allowedRanges) || isTokenValue(match[2])) {
      continue;
    }

    const location = getLineAndColumn(text, match.index);

    violations.push({
      filePath,
      line: location.line,
      column: location.column,
      match: `${match[1]}: ${match[2].trim()}`,
    });
  }

  return violations;
}

function collectInlineStyleViolations(text, filePath) {
  const violations = [];

  inlineStylePattern.lastIndex = 0;

  for (const match of text.matchAll(inlineStylePattern)) {
    if (isTokenValue(match[2])) {
      continue;
    }

    const location = getLineAndColumn(text, match.index);

    violations.push({
      filePath,
      line: location.line,
      column: location.column,
      match: `${match[1]}: ${match[2].trim()}`,
    });
  }

  return violations;
}

async function main() {
  const files = await walk(srcRoot);
  const violations = [];

  for (const filePath of files) {
    const text = await readFile(filePath, "utf8");

    if (path.extname(filePath) === ".css") {
      const tokenBlockRanges = filePath === globalsCssPath ? collectCssBlockRanges(text, /:root(?:\[[^\]]+\])?\s*\{/g) : [];
      violations.push(...collectCssViolations(text, filePath, tokenBlockRanges));
      continue;
    }

    violations.push(...collectInlineStyleViolations(text, filePath));
  }

  if (violations.length > 0) {
    console.error("Hardcoded typography audit failed.");
    for (const violation of violations) {
      console.error(`${path.relative(projectRoot, violation.filePath)}:${violation.line}:${violation.column} -> ${violation.match}`);
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
