import "server-only";

type ErrorRecord = Record<string, unknown>;

export type SafeErrorMessageOptions = {
  context: string;
  fallbackMessage: string;
  maxLength?: number;
  allowDevelopmentDetails?: boolean;
  log?: boolean;
  preserveMessage?: (message: string) => boolean;
};

const DEFAULT_SAFE_MESSAGE_MAX_LENGTH = 180;
const URL_SAFE_MESSAGE_MAX_LENGTH = 120;

const INTERNAL_MESSAGE_PATTERNS = [
  /\bsupabase\b/i,
  /\bpostgrest\b/i,
  /\bpgrst\d*\b/i,
  /schema cache/i,
  /\bdatabase\b/i,
  /\bsql\b/i,
  /duplicate key/i,
  /foreign key/i,
  /invalid input syntax/i,
  /violates .* constraint/i,
  /relation ["'`]?[\w.]+["'`]? does not exist/i,
  /column ["'`]?[\w.]+["'`]? does not exist/i,
  /\bgoogleapis\b/i,
  /\bgoogle drive\b/i,
  /\bgemini\b/i,
  /api[_ -]?key/i,
  /service[_ -]?role/i,
  /\bjwt\b/i,
  /\bauthorization\b/i,
  /https?:\/\//i,
  /\bat\s+\S+.*:\d+:\d+/i,
];

const REDACTION_PATTERNS: Array<[RegExp, string]> = [
  [/(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, "$1[redacted]"],
  [/(Authorization\s*[:=]\s*)["']?[^"',\s}]+/gi, "$1[redacted]"],
  [/((?:api[_ -]?key|token|refresh[_ -]?token|access[_ -]?token|service[_ -]?role)\s*[:=]\s*)["']?[^"',\s}]+/gi, "$1[redacted]"],
  [/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[redacted-jwt]"],
  [/AIza[0-9A-Za-z_-]{20,}/g, "[redacted-google-api-key]"],
];

function isRecord(value: unknown): value is ErrorRecord {
  return typeof value === "object" && value !== null;
}

function readStringProperty(value: unknown, key: string) {
  if (!isRecord(value)) {
    return null;
  }

  const property = value[key];

  return typeof property === "string" && property.trim().length > 0 ? property : null;
}

function readLogProperty(value: unknown, key: string) {
  if (!isRecord(value)) {
    return null;
  }

  const property = value[key];

  if (typeof property === "string" && property.trim().length > 0) {
    return redactSensitiveText(property);
  }

  if (typeof property === "number") {
    return String(property);
  }

  return null;
}

function readErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }

  return readStringProperty(error, "message") ?? "";
}

function redactSensitiveText(value: string) {
  return REDACTION_PATTERNS.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), value);
}

function normalizeUserMessage(value: string) {
  return redactSensitiveText(value).replace(/\s+/g, " ").trim();
}

function truncateMessage(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function looksInternal(message: string) {
  if (message.length > DEFAULT_SAFE_MESSAGE_MAX_LENGTH || /[\r\n]/.test(message)) {
    return true;
  }

  return INTERNAL_MESSAGE_PATTERNS.some((pattern) => pattern.test(message));
}

function isSafeOperatorMessage(message: string) {
  return message.length > 0 && !looksInternal(message);
}

function readErrorLogPayload(error: unknown) {
  const message = readErrorMessage(error);
  const stack = error instanceof Error ? error.stack : readStringProperty(error, "stack");

  return {
    name: error instanceof Error ? error.name : readStringProperty(error, "name"),
    message: message ? redactSensitiveText(message) : null,
    code: readLogProperty(error, "code"),
    status: readLogProperty(error, "status"),
    details: readLogProperty(error, "details"),
    hint: readLogProperty(error, "hint"),
    stack: process.env.NODE_ENV === "production" || !stack ? undefined : redactSensitiveText(stack),
  };
}

export function logServerError(context: string, error: unknown) {
  console.error(`[${context}]`, readErrorLogPayload(error));
}

export function toSafeErrorMessage(error: unknown, options: SafeErrorMessageOptions) {
  if (options.log !== false) {
    logServerError(options.context, error);
  }

  const rawMessage = readErrorMessage(error);
  const normalizedMessage = normalizeUserMessage(rawMessage);
  const maxLength = options.maxLength ?? DEFAULT_SAFE_MESSAGE_MAX_LENGTH;
  const shouldPreserveMessage =
    normalizedMessage.length > 0 && (options.preserveMessage?.(normalizedMessage) ?? isSafeOperatorMessage(normalizedMessage));

  if (shouldPreserveMessage) {
    return truncateMessage(normalizedMessage, maxLength);
  }

  if (process.env.NODE_ENV !== "production" && options.allowDevelopmentDetails !== false && normalizedMessage.length > 0) {
    return truncateMessage(normalizedMessage, maxLength);
  }

  return options.fallbackMessage;
}

export function toSafeUrlErrorMessage(error: unknown, options: Omit<SafeErrorMessageOptions, "maxLength"> & { maxLength?: number }) {
  return toSafeErrorMessage(error, {
    ...options,
    allowDevelopmentDetails: options.allowDevelopmentDetails ?? false,
    maxLength: options.maxLength ?? URL_SAFE_MESSAGE_MAX_LENGTH,
  });
}
