export type GeminiFailureKind =
  | "RATE_LIMITED"
  | "TRANSIENT_UPSTREAM"
  | "AUTH_MISCONFIG"
  | "MODEL_NOT_FOUND"
  | "MISSING_INPUT"
  | "UNKNOWN";

export type GeminiFailureDisposition = {
  kind: GeminiFailureKind;
  retryableTask: boolean;
  excludeKeyId: boolean;
  excludeQuotaGroup: boolean;
  markKeyError: boolean;
  markGroupError: boolean;
  markGroupCooldown: boolean;
  nextStatus: "RATE_LIMITED" | "COOLDOWN" | null;
  cooldownUntil: string | null;
};

function readErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message.trim();
  }

  return "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readStatusCode(error: unknown) {
  if (isRecord(error) && typeof error.status === "number") {
    return error.status;
  }

  return null;
}

function readRetryAfterSeconds(error: unknown) {
  if (isRecord(error) && typeof error.retryAfterSeconds === "number" && Number.isFinite(error.retryAfterSeconds)) {
    return error.retryAfterSeconds;
  }

  return null;
}

export function getGeminiFailureDisposition(error: unknown): GeminiFailureDisposition {
  const status = readStatusCode(error);
  const retryAfterSeconds = readRetryAfterSeconds(error);
  const cooldownUntil =
    retryAfterSeconds !== null && retryAfterSeconds > 0
      ? new Date(Date.now() + retryAfterSeconds * 1000).toISOString()
      : null;

  if (typeof status === "number") {
    if (status === 429) {
      return {
        kind: "RATE_LIMITED",
        retryableTask: true,
        excludeKeyId: false,
        excludeQuotaGroup: true,
        markKeyError: false,
        markGroupError: false,
        markGroupCooldown: true,
        nextStatus: retryAfterSeconds && retryAfterSeconds > 0 ? "COOLDOWN" : "RATE_LIMITED",
        cooldownUntil,
      };
    }

    if (status === 408 || status >= 500) {
      return {
        kind: "TRANSIENT_UPSTREAM",
        retryableTask: true,
        excludeKeyId: false,
        excludeQuotaGroup: true,
        markKeyError: false,
        markGroupError: false,
        markGroupCooldown: false,
        nextStatus: null,
        cooldownUntil: null,
      };
    }

    if (status === 401 || status === 403) {
      return {
        kind: "AUTH_MISCONFIG",
        retryableTask: false,
        excludeKeyId: true,
        excludeQuotaGroup: false,
        markKeyError: true,
        markGroupError: false,
        markGroupCooldown: false,
        nextStatus: null,
        cooldownUntil: null,
      };
    }

    if (status === 404) {
      return {
        kind: "MODEL_NOT_FOUND",
        retryableTask: false,
        excludeKeyId: false,
        excludeQuotaGroup: true,
        markKeyError: false,
        markGroupError: true,
        markGroupCooldown: false,
        nextStatus: null,
        cooldownUntil: null,
      };
    }

    if (status === 400) {
      return {
        kind: "MISSING_INPUT",
        retryableTask: false,
        excludeKeyId: false,
        excludeQuotaGroup: false,
        markKeyError: false,
        markGroupError: false,
        markGroupCooldown: false,
        nextStatus: null,
        cooldownUntil: null,
      };
    }
  }

  const message = readErrorMessage(error);

  if (message) {
    if (message.includes("request requires a prompt or image parts")) {
      return {
        kind: "MISSING_INPUT",
        retryableTask: false,
        excludeKeyId: false,
        excludeQuotaGroup: false,
        markKeyError: false,
        markGroupError: false,
        markGroupCooldown: false,
        nextStatus: null,
        cooldownUntil: null,
      };
    }
  }

  return {
    kind: "UNKNOWN",
    retryableTask: false,
    excludeKeyId: false,
    excludeQuotaGroup: false,
    markKeyError: false,
    markGroupError: false,
    markGroupCooldown: false,
    nextStatus: null,
    cooldownUntil: null,
  };
}

export function isGeminiRetryableFailure(error: unknown) {
  const disposition = getGeminiFailureDisposition(error);
  return disposition.retryableTask;
}

export function isGeminiAuthMisconfigFailure(error: unknown) {
  return getGeminiFailureDisposition(error).kind === "AUTH_MISCONFIG";
}

export function isGeminiModelNotFoundFailure(error: unknown) {
  return getGeminiFailureDisposition(error).kind === "MODEL_NOT_FOUND";
}

export function isGeminiTransientFailure(error: unknown) {
  const kind = getGeminiFailureDisposition(error).kind;
  return kind === "RATE_LIMITED" || kind === "TRANSIENT_UPSTREAM";
}

export function isGeminiMissingInputFailure(error: unknown) {
  return getGeminiFailureDisposition(error).kind === "MISSING_INPUT";
}
