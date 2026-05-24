import "server-only";

import fs from "node:fs";
import path from "node:path";
import packageJson from "../../../package.json";

type AppReleaseFaqItem = {
  answer: string;
  question: string;
};

type AppReleaseEntry = {
  summary: string;
  version: string;
};

type AppReleaseMeta = {
  branch?: string;
  buildNumber?: string;
  commitSha?: string;
  commitShortSha?: string;
  generatedAt?: string;
  releaseDate?: string;
  source?: string;
};

const APP_NAME = "Banplex OS";
const OWNER_NAME = "Dzul Qornain";
const releaseMetaPath = path.join(process.cwd(), "public", "release-meta.json");

function formatBuildNumber(version: string) {
  const [core, preRelease = "0"] = version.split("-");
  const [year, month, day] = core.split(".");
  const buildNumber = preRelease.split(".")[0] ?? "0";

  return `${year}.${month?.padStart(2, "0") ?? "00"}.${day?.padStart(2, "0") ?? "00"}.${buildNumber}`;
}

function formatReleaseDate(version: string) {
  const [year, month, day] = version.split("-")[0].split(".");

  return `${year}-${month?.padStart(2, "0") ?? "00"}-${day?.padStart(2, "0") ?? "00"}`;
}

function readReleaseMeta(): AppReleaseMeta | null {
  try {
    if (!fs.existsSync(releaseMetaPath)) {
      return null;
    }

    return JSON.parse(fs.readFileSync(releaseMetaPath, "utf8")) as AppReleaseMeta;
  } catch {
    return null;
  }
}

function readText(value: string | undefined, fallback: string) {
  const normalized = value?.trim();
  return normalized ? normalized : fallback;
}

const releaseMeta = readReleaseMeta();

export const APP_RELEASE = {
  appName: APP_NAME,
  branch: readText(releaseMeta?.branch, ""),
  buildNumber: readText(releaseMeta?.buildNumber, formatBuildNumber(packageJson.version)),
  buildSource: readText(releaseMeta?.source, releaseMeta ? "release-meta" : "package"),
  commitSha: readText(releaseMeta?.commitSha, ""),
  commitShortSha: readText(releaseMeta?.commitShortSha, ""),
  copyrightLine: `Copyright 2026 ${OWNER_NAME}`,
  generatedAt: readText(releaseMeta?.generatedAt, ""),
  ownerName: OWNER_NAME,
  packageVersion: packageJson.version,
  releaseDate: readText(releaseMeta?.releaseDate, formatReleaseDate(packageJson.version)),
} as const;

export const APP_RELEASE_FAQ: AppReleaseFaqItem[] = [
  {
    question: "Di mana versi app terlihat?",
    answer: "Di footer shell dan Settings > Tentang.",
  },
  {
    question: "Apa arti build number?",
    answer: "Nomor rilis otomatis bertanggal dengan format YYYY.MM.DD.N.",
  },
  {
    question: "Apakah ada sertifikat resmi?",
    answer: "Belum ada. Saat ini formal pack hanya mencakup About, FAQ, changelog, dan copyright.",
  },
  {
    question: "Kapan versi dinaikkan?",
    answer: "Setiap push atau deploy yang menjalankan build metadata.",
  },
  {
    question: "Apa bedanya dengan versi prompt?",
    answer: "Versi prompt dan riwayat data tetap terpisah dari versi rilis app.",
  },
];

export const APP_RELEASE_CHANGELOG: AppReleaseEntry[] = [
  {
    version: APP_RELEASE.buildNumber,
    summary: "Brand Banplex OS, metadata rilis otomatis, changelog, dan copyright diformalisasi.",
  },
];
