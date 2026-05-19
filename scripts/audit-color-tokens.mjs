#!/usr/bin/env node

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();
const srcRoot = path.join(projectRoot, "src");
const globalsCssPath = path.join(srcRoot, "app", "globals.css");
const layoutPath = path.join(srcRoot, "app", "layout.tsx");
const colorPattern = /(#(?:[0-9a-fA-F]{3,8})\b|\b(?:rgba?|hsla?)\s*\()/g;
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

function collectLiteralViolations(text, filePath, allowedRanges = []) {
  const violations = [];

  colorPattern.lastIndex = 0;

  for (const match of text.matchAll(colorPattern)) {
    if (isInsideRange(match.index, allowedRanges)) {
      continue;
    }

    const location = getLineAndColumn(text, match.index);

    violations.push({
      filePath,
      line: location.line,
      column: location.column,
      match: match[0],
    });
  }

  return violations;
}

function collectGlobalsCssViolations(text, filePath) {
  const tokenBlockRanges = collectCssBlockRanges(text, /:root(?:\[[^\]]+\])?\s*\{/g);

  return collectLiteralViolations(text, filePath, tokenBlockRanges);
}

function validateLayoutThemeColor(text, filePath) {
  const hasThemeColorArray = /themeColor:\s*\[/.test(text);
  const hasLightThemeColor = /media:\s*"\(prefers-color-scheme: light\)"[\s\S]*?color:\s*"#f8fbfd"/.test(text);
  const hasDarkThemeColor = /media:\s*"\(prefers-color-scheme: dark\)"[\s\S]*?color:\s*"#070809"/.test(text);

  if (!hasThemeColorArray || !hasLightThemeColor || !hasDarkThemeColor) {
    return [
      {
        filePath,
        line: 1,
        match: "viewport.themeColor must stay as the approved light/dark descriptor pair",
      },
    ];
  }

  return [];
}

async function main() {
  const files = await walk(srcRoot);
  const violations = [];

  for (const filePath of files) {
    const text = await readFile(filePath, "utf8");

    if (filePath === globalsCssPath) {
      violations.push(...collectGlobalsCssViolations(text, filePath));
      continue;
    }

    if (filePath === layoutPath) {
      violations.push(...validateLayoutThemeColor(text, filePath));
      continue;
    }

    violations.push(...collectLiteralViolations(text, filePath));
  }

  if (violations.length > 0) {
    console.error("Hardcoded color audit failed.");
    for (const violation of violations) {
      console.error(`${path.relative(projectRoot, violation.filePath)}:${violation.line}:${violation.column} -> ${violation.match}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log("Hardcoded color audit passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
