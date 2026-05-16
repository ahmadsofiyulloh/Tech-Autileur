import type { MarketplacePlatform } from "@/lib/intake/validation";

export type BulkImportOptionalFields = {
  availableColors: string | null;
  availableSizes: string | null;
  description: string | null;
  discountText: string | null;
  globalReviewText: string | null;
  priceText: string | null;
  ratingText: string | null;
  shopName: string | null;
  soldCountText: string | null;
};

export type BulkImportRowStatus = "ready" | "duplicate" | "error" | "imported" | "skipped" | "cancelled";

export type BulkImportPreviewRow = {
  rowNumber: number;
  status: BulkImportRowStatus;
  errors: string[];
  productName: string;
  productUrl: string;
  imageUrl: string;
  marketplaceLabel: string;
  platform: MarketplacePlatform | null;
  sourceDomain: string | null;
  optional: BulkImportOptionalFields;
  rawColumns: Record<string, string>;
  productId?: string;
  intakeSessionId?: string;
  driveItemId?: string;
};

export type BulkImportSummary = {
  totalRows: number;
  readyRows: number;
  duplicateRows: number;
  errorRows: number;
  importedRows: number;
  skippedRows: number;
  cancelledRows: number;
};

export type BulkImportResponse = {
  fileName: string;
  rows: BulkImportPreviewRow[];
  summary: BulkImportSummary;
};

export type BulkImportJobStatus =
  | "QUEUED"
  | "RUNNING"
  | "CANCEL_REQUESTED"
  | "CANCELLED"
  | "COMPLETED"
  | "FAILED";

export type BulkImportJobRowStatus =
  | "READY"
  | "RUNNING"
  | "IMAGE_DOWNLOADING"
  | "IMAGE_UPLOADING"
  | "PRODUCT_CREATING"
  | "IMPORTED"
  | "SKIPPED"
  | "ERROR"
  | "CANCELLED";

export type BulkImportLogLevel = "INFO" | "SUCCESS" | "WARNING" | "ERROR";

export type BulkImportJob = {
  id: string;
  status: BulkImportJobStatus;
  fileName: string;
  summary: BulkImportSummary;
  errorMessage: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  cancelRequestedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BulkImportJobRow = BulkImportPreviewRow & {
  id: string;
  jobId: string;
  jobStatus: BulkImportJobRowStatus;
  currentStage: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BulkImportJobLog = {
  id: string;
  jobId: string;
  rowId: string | null;
  sequence: number;
  level: BulkImportLogLevel;
  title: string;
  message: string;
  createdAt: string;
};

export type BulkImportJobSnapshot = {
  job: BulkImportJob;
  rows: BulkImportJobRow[];
  logs: BulkImportJobLog[];
  result: BulkImportResponse;
};
