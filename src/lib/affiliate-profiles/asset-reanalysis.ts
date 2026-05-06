import type { JsonObject } from "@/lib/affiliate-profiles/validation";

export type AffiliateProfileAssetKind = "CHARACTER" | "ENVIRONMENT";

export type AffiliateProfileAssetReanalysisResultStatus = "success" | "warning" | "error" | "skipped";

export type AffiliateProfileAssetReanalysisStatus = "idle" | "success" | "warning" | "error";

export type AffiliateProfileAssetReanalysisResult = {
  kind: AffiliateProfileAssetKind;
  status: AffiliateProfileAssetReanalysisResultStatus;
  message: string;
  driveItemRefId: string | null;
  analysisStored: boolean;
};

export type AffiliateProfileAssetReanalysisState = {
  status: AffiliateProfileAssetReanalysisStatus;
  title: string | null;
  message: string | null;
  assetResults: AffiliateProfileAssetReanalysisResult[];
};

export const AFFILIATE_PROFILE_ASSET_REANALYSIS_INITIAL_STATE = {
  status: "idle",
  title: null,
  message: null,
  assetResults: [],
} satisfies AffiliateProfileAssetReanalysisState;

export function formatAffiliateProfileAssetKind(kind: AffiliateProfileAssetKind) {
  return kind === "CHARACTER" ? "Character" : "Environment";
}

export function canonicalizeAffiliateProfileAssetAnalysisJson(
  analysisJson: JsonObject | null | undefined,
  driveItemRefId: string,
): JsonObject | null {
  const normalizedDriveItemRefId = typeof driveItemRefId === "string" ? driveItemRefId.trim() : "";

  if (!analysisJson || !normalizedDriveItemRefId) {
    return null;
  }

  return {
    ...analysisJson,
    drive_item_ref_id: normalizedDriveItemRefId,
  } satisfies JsonObject;
}

export function buildAffiliateProfileAssetReanalysisState(
  assetResults: AffiliateProfileAssetReanalysisResult[],
): AffiliateProfileAssetReanalysisState {
  const actionableResults = assetResults.filter((result) => result.status !== "skipped");

  if (!actionableResults.length) {
    return {
      status: "warning",
      title: "Tidak ada asset yang dianalisis",
      message: "Aktifkan lock Character atau Environment untuk menjalankan analisis.",
      assetResults,
    };
  }

  const successCount = actionableResults.filter((result) => result.status === "success").length;
  const warningCount = actionableResults.filter((result) => result.status === "warning").length;
  const errorCount = actionableResults.filter((result) => result.status === "error").length;

  if (warningCount === 0 && errorCount === 0) {
    return {
      status: "success",
      title: "Analisis aset selesai",
      message: `${successCount} asset tersimpan dengan ref aktif.`,
      assetResults,
    };
  }

  if (errorCount === 0) {
    return {
      status: "warning",
      title: "Analisis selesai sebagian",
      message: `${successCount} asset tersimpan, ${warningCount} perlu dicek ulang.`,
      assetResults,
    };
  }

  if (successCount > 0) {
    return {
      status: "warning",
      title: "Analisis selesai sebagian",
      message: `${successCount} asset tersimpan, ${errorCount} gagal.`,
      assetResults,
    };
  }

  return {
    status: "error",
    title: "Analisis aset gagal",
    message: `${errorCount} asset gagal disimpan.`,
    assetResults,
  };
}
