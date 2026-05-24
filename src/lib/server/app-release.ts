import "server-only";

import packageJson from "../../../package.json";

type AppReleaseFaqItem = {
  answer: string;
  question: string;
};

type AppReleaseEntry = {
  summary: string;
  version: string;
};

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

export const APP_RELEASE = {
  appName: "Affiliate AI Content OS",
  buildNumber: formatBuildNumber(packageJson.version),
  copyrightLine: "Copyright 2026 Tech Autiluer",
  ownerName: "Tech Autiluer",
  packageVersion: packageJson.version,
  releaseDate: formatReleaseDate(packageJson.version),
} as const;

export const APP_RELEASE_FAQ: AppReleaseFaqItem[] = [
  {
    question: "Di mana versi app terlihat?",
    answer: "Di footer shell dan Settings > Tentang.",
  },
  {
    question: "Apa arti build number?",
    answer: "Nomor rilis bertanggal dengan format YYYY.MM.DD.N.",
  },
  {
    question: "Apakah ada sertifikat resmi?",
    answer: "Belum ada. Saat ini formal pack hanya mencakup About, FAQ, changelog, dan copyright.",
  },
  {
    question: "Kapan versi dinaikkan?",
    answer: "Setiap rilis formal atau bundle perubahan yang siap dipakai operator.",
  },
  {
    question: "Apa bedanya dengan versi prompt?",
    answer: "Versi prompt dan riwayat data tetap terpisah dari versi rilis app.",
  },
];

export const APP_RELEASE_CHANGELOG: AppReleaseEntry[] = [
  {
    version: APP_RELEASE.buildNumber,
    summary: "Footer shell, Settings > Tentang, FAQ, changelog, dan copyright diformalisasi.",
  },
];
