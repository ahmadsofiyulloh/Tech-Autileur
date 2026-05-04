#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";

const filePath = new URL("../src/app/globals.css", import.meta.url);

const replacements = [
  ["font-size: 1.72rem;", "font-size: var(--type-page-title-size);"],
  ["font-size: 1.58rem;", "font-size: var(--type-section-title-size);"],
  ["font-size: 1.36rem;", "font-size: var(--type-panel-title-size);"],
  ["font-size: 1.24rem;", "font-size: var(--type-size-124);"],
  ["font-size: 1.18rem;", "font-size: var(--type-size-118);"],
  ["font-size: 1.1rem;", "font-size: var(--type-size-110);"],
  ["font-size: 1.05rem;", "font-size: var(--type-size-105);"],
  ["font-size: 1.02rem;", "font-size: var(--type-size-102);"],
  ["font-size: 1rem;", "font-size: var(--type-size-100);"],
  ["font-size: 0.98rem;", "font-size: var(--type-size-098);"],
  ["font-size: 0.94rem;", "font-size: var(--type-size-094);"],
  ["font-size: 0.92rem;", "font-size: var(--type-size-092);"],
  ["font-size: 0.9rem;", "font-size: var(--type-size-090);"],
  ["font-size: 0.88rem;", "font-size: var(--type-size-088);"],
  ["font-size: 0.86rem;", "font-size: var(--type-size-086);"],
  ["font-size: 0.84rem;", "font-size: var(--type-size-084);"],
  ["font-size: 0.82rem;", "font-size: var(--type-size-082);"],
  ["font-size: 0.8rem;", "font-size: var(--type-size-080);"],
  ["font-size: 0.78rem;", "font-size: var(--type-size-078);"],
  ["font-size: 0.76rem;", "font-size: var(--type-size-076);"],
  ["font-size: 0.72rem;", "font-size: var(--type-size-072);"],
  ["font-size: 0.7rem;", "font-size: var(--type-size-070);"],
  ["font-size: 26px;", "font-size: var(--type-size-26);"],
  ["font-size: 20px;", "font-size: var(--type-size-20);"],
  ["font-size: 18px;", "font-size: var(--type-size-18);"],
  ["font-size: 16px;", "font-size: var(--type-size-16);"],
  ["font-size: 15px;", "font-size: var(--type-size-15);"],
  ["font-size: 14px;", "font-size: var(--type-size-14);"],
  ["font-size: 13px;", "font-size: var(--type-size-13);"],
  ["font-size: 12px;", "font-size: var(--type-size-12);"],
  ["font-size: 11px;", "font-size: var(--type-size-11);"],
  ["font-size: 10px;", "font-size: var(--type-size-10);"],
  ["line-height: 1.6;", "line-height: var(--type-line-160);"],
  ["line-height: 1.48;", "line-height: var(--type-line-148);"],
  ["line-height: 1.46;", "line-height: var(--type-line-146);"],
  ["line-height: 1.42;", "line-height: var(--type-line-142);"],
  ["line-height: 1.35;", "line-height: var(--type-line-135);"],
  ["line-height: 1.3;", "line-height: var(--type-line-130);"],
  ["line-height: 1.28;", "line-height: var(--type-line-128);"],
  ["line-height: 1.25;", "line-height: var(--type-line-125);"],
  ["line-height: 1.24;", "line-height: var(--type-line-124);"],
  ["line-height: 1.2;", "line-height: var(--type-line-120);"],
  ["line-height: 1.18;", "line-height: var(--type-line-118);"],
  ["line-height: 1.15;", "line-height: var(--type-line-115);"],
  ["line-height: 1.12;", "line-height: var(--type-line-112);"],
  ["line-height: 1.1;", "line-height: var(--type-line-110);"],
  ["line-height: 1.08;", "line-height: var(--type-line-108);"],
  ["line-height: 1.05;", "line-height: var(--type-line-105);"],
  ["line-height: 1;", "line-height: var(--type-line-100);"],
  ["font-weight: 740;", "font-weight: var(--type-weight-740);"],
  ["font-weight: 720;", "font-weight: var(--type-weight-720);"],
  ["font-weight: 700;", "font-weight: var(--type-weight-700);"],
  ["font-weight: 680;", "font-weight: var(--type-weight-680);"],
  ["font-weight: 650;", "font-weight: var(--type-weight-650);"],
  ["font-weight: 640;", "font-weight: var(--type-weight-640);"],
  ["font-weight: 600;", "font-weight: var(--type-weight-600);"],
  ["font-weight: 500;", "font-weight: var(--type-weight-500);"],
  ["font-weight: 400;", "font-weight: var(--type-weight-400);"],
  ["letter-spacing: 0.075em;", "letter-spacing: var(--type-letter-0075);"],
  ["letter-spacing: 0.07em;", "letter-spacing: var(--type-letter-007);"],
  ["letter-spacing: 0.01em;", "letter-spacing: var(--type-letter-001);"],
  ["letter-spacing: 0;", "letter-spacing: var(--type-letter-0);"],
];

async function main() {
  const original = await readFile(filePath, "utf8");
  let output = original;

  for (const [from, to] of replacements) {
    output = output.split(from).join(to);
  }

  if (output !== original) {
    await writeFile(filePath, output, "utf8");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
