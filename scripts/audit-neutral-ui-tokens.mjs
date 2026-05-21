#!/usr/bin/env node

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();
const stylesRoot = path.join(projectRoot, "src", "styles");
const globalsCssPath = path.join(projectRoot, "src", "app", "globals.css");
const buttonsCssPath = path.join(stylesRoot, "00-tokens", "buttons.css");
const vercelFlatOverridesPath = path.join(stylesRoot, "02-themes", "vercel-flat-overrides.css");
const neutralActionPath = path.join(stylesRoot, "99-overrides", "neutral-action-system.css");
const neutralActionImport = '@import "../styles/99-overrides/neutral-action-system.css";';
const sourceExtensions = new Set([".css"]);
const gradientPattern = /\b(?:linear|radial|conic)-gradient\s*\(/i;
const blueLiteralPattern =
  /#(?:005cc5|0070e8|0070f3|2563eb|2f77ce|3291ff|367ed4|3b82f6|52c3df|60a5fa|6e8eff|a7d4ff)\b/i;
const disallowedActionTokenPattern =
  /var\(\s*--(?:color-primary(?:-(?:soft|strong))?|accent(?:-(?:soft|strong))?|auth-primary(?:-(?:soft|strong))?|color-button-primary-shadow|auth-button-shadow|color-status-error(?:-(?:soft|border))?)\s*[,)]/g;
const buttonSelectorHints = [
  ".button",
  "__button",
  "-button",
  "[role=button]",
  ".auth-submit",
  ".topbar-menu-item",
  ".topbar-action",
  ".nav-link",
  ".bottom-nav__link",
  ".content-filter-tab",
  ".theme-mode-toggle__option",
  ".drive-view-toggle__button",
  ".drive-breadcrumb__button",
  ".shell-pull-to-refresh__button",
  ".controller-stepper-rail__button",
  ".intake-stepper__rail-button",
  ".gemini-usage-carousel__button",
];
const excludedButtonSelectors = [".skeleton-button", ".status-badge"];
const requiredNeutralSelectors = [
  ".button.primary",
  ".auth-form .auth-submit",
  ".nav-link[data-active",
  ".bottom-nav__link[data-active",
  ".drive-view-toggle__button[data-active=true]",
  ".content-filter-tab[data-active=true]",
  ".theme-mode-toggle__option[data-active=true]",
];

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

function findBlockEnd(text, openBraceIndex) {
  let depth = 0;

  for (let index = openBraceIndex; index < text.length; index += 1) {
    if (text[index] === "{") {
      depth += 1;
      continue;
    }

    if (text[index] === "}") {
      depth -= 1;
      if (depth === 0) {
        return index + 1;
      }
    }
  }

  return text.length;
}

function collectCssBlocks(text) {
  const blocks = [];
  const selectorPattern = /([^{}]+)\{/g;
  let match;

  while ((match = selectorPattern.exec(text)) !== null) {
    const openBraceIndex = selectorPattern.lastIndex - 1;
    const end = findBlockEnd(text, openBraceIndex);

    blocks.push({
      selector: match[1].trim(),
      body: text.slice(openBraceIndex + 1, end - 1),
      bodyStart: openBraceIndex + 1,
    });
  }

  return blocks;
}

function isButtonSelector(selector) {
  const normalized = selector.toLowerCase();

  if (normalized.startsWith("@") || excludedButtonSelectors.some((hint) => normalized.includes(hint))) {
    return false;
  }

  return (
    /(^|[\s,>+~])button(?:$|[.#:[\s,>+~])/.test(normalized) ||
    buttonSelectorHints.some((hint) => normalized.includes(hint))
  );
}

function pushViolation(violations, text, filePath, index, message) {
  const location = getLineAndColumn(text, index);

  violations.push({
    filePath,
    line: location.line,
    column: location.column,
    message,
  });
}

function collectButtonRuleViolations(text, filePath) {
  const violations = [];
  const blocks = collectCssBlocks(text);

  for (const block of blocks) {
    if (!isButtonSelector(block.selector)) {
      continue;
    }

    const gradientMatch = block.body.match(gradientPattern);
    if (gradientMatch) {
      pushViolation(
        violations,
        text,
        filePath,
        block.bodyStart + gradientMatch.index,
        `button/control rule uses a gradient in selector "${block.selector}"`,
      );
    }

    disallowedActionTokenPattern.lastIndex = 0;
    for (const tokenMatch of block.body.matchAll(disallowedActionTokenPattern)) {
      pushViolation(
        violations,
        text,
        filePath,
        block.bodyStart + tokenMatch.index,
        `button/control rule bypasses neutral action tokens with ${tokenMatch[0]}`,
      );
    }
  }

  return violations;
}

function collectNeutralContractViolations(text, filePath) {
  const violations = [];

  for (const selector of requiredNeutralSelectors) {
    if (!text.includes(selector)) {
      violations.push({
        filePath,
        line: 1,
        column: 1,
        message: `neutral action override is missing required selector coverage: ${selector}`,
      });
    }
  }

  if (/status-badge/i.test(text)) {
    pushViolation(violations, text, filePath, text.search(/status-badge/i), "neutral action override must not restyle badges");
  }

  const gradientMatch = text.match(gradientPattern);
  if (gradientMatch) {
    pushViolation(violations, text, filePath, gradientMatch.index, "neutral action override must not contain gradients");
  }

  return violations;
}

function collectBlueLiteralViolations(text, filePath) {
  const violations = [];
  const blueMatch = text.match(blueLiteralPattern);

  if (blueMatch) {
    pushViolation(violations, text, filePath, blueMatch.index, `action token contract contains blue literal ${blueMatch[0]}`);
  }

  return violations;
}

function collectGlobalsImportViolations(text, filePath) {
  const importMatches = Array.from(text.matchAll(/^@import\s+["'][^"']+["'];/gm));
  const lastImport = importMatches.at(-1)?.[0]?.trim();

  if (lastImport !== neutralActionImport) {
    return [
      {
        filePath,
        line: 1,
        column: 1,
        message: "neutral action override must be the final globals.css import",
      },
    ];
  }

  return [];
}

async function main() {
  const cssFiles = await walk(stylesRoot);
  const violations = [];
  const globalsCss = await readFile(globalsCssPath, "utf8");
  const neutralActionCss = await readFile(neutralActionPath, "utf8");

  violations.push(...collectGlobalsImportViolations(globalsCss, globalsCssPath));
  violations.push(...collectNeutralContractViolations(neutralActionCss, neutralActionPath));

  for (const filePath of [buttonsCssPath, vercelFlatOverridesPath, neutralActionPath]) {
    const text = await readFile(filePath, "utf8");
    violations.push(...collectBlueLiteralViolations(text, filePath));
  }

  for (const filePath of cssFiles) {
    const text = await readFile(filePath, "utf8");
    violations.push(...collectButtonRuleViolations(text, filePath));
  }

  if (violations.length > 0) {
    console.error("Neutral UI token audit failed.");
    for (const violation of violations) {
      console.error(`${path.relative(projectRoot, violation.filePath)}:${violation.line}:${violation.column} -> ${violation.message}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log("Neutral UI token audit passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
