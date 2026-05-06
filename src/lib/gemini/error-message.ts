export const GEMINI_TEMPORARY_UNAVAILABLE_MESSAGE = "Gemini service is temporarily unavailable." as const;
export const GEMINI_TEMPORARY_UNAVAILABLE_RETRY_MESSAGE = "Gemini sedang tidak tersedia sementara. Coba lagi beberapa saat lagi." as const;

export function isGeminiTemporaryUnavailableMessage(message: string) {
  return message.trim() === GEMINI_TEMPORARY_UNAVAILABLE_MESSAGE;
}

export function getGeminiTemporaryUnavailableRetryMessage() {
  return GEMINI_TEMPORARY_UNAVAILABLE_RETRY_MESSAGE;
}

export function sanitizeGeminiStatusMessage(status: number, fallback = "Gemini request failed.", upstreamMessage?: string | null) {
  if (status === 401) {
    return "Gemini authorization failed.";
  }

  if (status === 403) {
    return "Gemini access denied.";
  }

  if (status === 404) {
    return "Gemini model was not found.";
  }

  if (status === 408) {
    return "Gemini request timed out.";
  }

  if (status === 429) {
    return "Gemini rate limit reached.";
  }

  if (status >= 500) {
    return GEMINI_TEMPORARY_UNAVAILABLE_MESSAGE;
  }

  if (typeof upstreamMessage === "string" && upstreamMessage.trim()) {
    return upstreamMessage.trim();
  }

  return fallback;
}
