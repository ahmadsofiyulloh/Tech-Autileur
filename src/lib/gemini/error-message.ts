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
    return "Gemini service is temporarily unavailable.";
  }

  if (typeof upstreamMessage === "string" && upstreamMessage.trim()) {
    return upstreamMessage.trim();
  }

  return fallback;
}
