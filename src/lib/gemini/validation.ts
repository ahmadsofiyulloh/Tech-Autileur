export const GEMINI_MODELS = ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-lite"] as const;

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
export type GeminiKeyRole = (typeof GEMINI_KEY_ROLES)[number];
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export function isGeminiModelName(value: string): value is GeminiModelName {
  return (GEMINI_MODELS as readonly string[]).includes(value);
}

export function isGeminiKeyRole(value: string): value is GeminiKeyRole {
  return (GEMINI_KEY_ROLES as readonly string[]).includes(value);
}

export function isAccountStatus(value: string): value is AccountStatus {
  return (ACCOUNT_STATUSES as readonly string[]).includes(value);
}
