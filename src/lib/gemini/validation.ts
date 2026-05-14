export const GEMINI_MODELS = [
  "gemini-3.1-flash-lite",
  "gemini-3-flash",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
] as const;

export const GEMINI_ZERO_QUOTA_MODELS = ["gemini-2.5-pro", "gemini-2.0-flash", "gemini-3.1-pro"] as const;

export const GEMINI_DATABASE_MODELS = [...GEMINI_MODELS, ...GEMINI_ZERO_QUOTA_MODELS] as const;

export const GEMINI_MODEL_QUOTA_DEFAULTS = {
  "gemini-3.1-flash-lite": {
    rpmLimit: 15,
    rpdLimit: 500,
    tpmLimit: 250000,
  },
  "gemini-3-flash": {
    rpmLimit: 5,
    rpdLimit: 20,
    tpmLimit: 250000,
  },
  "gemini-2.5-flash": {
    rpmLimit: 5,
    rpdLimit: 20,
    tpmLimit: 250000,
  },
  "gemini-2.5-flash-lite": {
    rpmLimit: 10,
    rpdLimit: 20,
    tpmLimit: 250000,
  },
} as const satisfies Record<(typeof GEMINI_MODELS)[number], { rpmLimit: number; rpdLimit: number; tpmLimit: number }>;

export const GEMINI_MODEL_LABELS = {
  "gemini-3.1-flash-lite": "Gemini 3.1 Flash Lite",
  "gemini-3-flash": "Gemini 3 Flash",
  "gemini-2.5-flash": "Gemini 2.5 Flash",
  "gemini-2.5-flash-lite": "Gemini 2.5 Flash Lite",
} as const satisfies Record<(typeof GEMINI_MODELS)[number], string>;

export const GEMINI_KEY_ROLES = [
  "VISION_ANALYSIS",
  "I2I_PROMPT",
  "I2V_PROMPT",
  "CONSISTENCY_CHECK",
  "PROMPT_REPAIR",
  "FALLBACK",
] as const;

export const ACCOUNT_STATUSES = ["ACTIVE", "COOLDOWN", "RATE_LIMITED", "DISABLED", "ERROR"] as const;

export type GeminiModelName = (typeof GEMINI_MODELS)[number];
export type GeminiDatabaseModelName = (typeof GEMINI_DATABASE_MODELS)[number];
export type GeminiKeyRole = (typeof GEMINI_KEY_ROLES)[number];
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export function isGeminiModelName(value: string): value is GeminiModelName {
  return (GEMINI_MODELS as readonly string[]).includes(value);
}

export function isGeminiDatabaseModelName(value: string): value is GeminiDatabaseModelName {
  return (GEMINI_DATABASE_MODELS as readonly string[]).includes(value);
}

export function formatGeminiModelQuota(value: GeminiModelName) {
  const quota = GEMINI_MODEL_QUOTA_DEFAULTS[value];

  return `RPM ${quota.rpmLimit} / RPD ${quota.rpdLimit} / TPM ${quota.tpmLimit.toLocaleString("id-ID")}`;
}

export function getGeminiModelLabel(value: string) {
  return isGeminiModelName(value) ? GEMINI_MODEL_LABELS[value] : value;
}

export const GEMINI_MODEL_OPTIONS = GEMINI_MODELS.map((value) => ({
  value,
  label: GEMINI_MODEL_LABELS[value],
  description: formatGeminiModelQuota(value),
}));

export function isGeminiKeyRole(value: string): value is GeminiKeyRole {
  return (GEMINI_KEY_ROLES as readonly string[]).includes(value);
}

export function isAccountStatus(value: string): value is AccountStatus {
  return (ACCOUNT_STATUSES as readonly string[]).includes(value);
}
