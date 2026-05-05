export type GeminiUsageMetric = {
  label: "RPD" | "RPM" | "TPM";
  limit: number | null;
  remaining: number | null;
  used: number;
  percent: number | null;
};

export type GeminiUsageCard = {
  id: string;
  label: string;
  modelName: string;
  role: string;
  status: string;
  projectLabel: string | null;
  groupLabel: string;
  isProjectScoped: boolean;
  hasMixedLimits: boolean;
  rpd: GeminiUsageMetric;
  rpm: GeminiUsageMetric;
  tpm: GeminiUsageMetric;
};

export type GeminiUsageOverview = {
  cards: GeminiUsageCard[];
  generatedAt: string;
  unavailableMessage: string | null;
};
