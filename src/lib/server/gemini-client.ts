import "server-only";

import type { GeminiModelName } from "@/lib/gemini/validation";

type JsonValue = string | number | boolean | null | { [key: string]: JsonValue } | JsonValue[];
type JsonObject = { [key: string]: JsonValue };

type GeminiInlineDataPart = {
  inline_data: {
    mime_type: string;
    data: string;
  };
};

type GeminiTextPart = {
  text: string;
};

type GeminiPart = GeminiTextPart | GeminiInlineDataPart;

type GeminiGenerateContentOptions = {
  modelName: GeminiModelName;
  apiKey: string;
  prompt?: string;
  parts?: GeminiPart[];
  responseJsonSchema?: JsonObject;
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
};

type GeminiCandidate = {
  content?: {
    parts?: Array<{
      text?: string;
    }>;
  };
};

type GeminiErrorResponse = {
  error?: {
    message?: string;
    status?: string;
    code?: number;
    details?: unknown;
  };
};

export class GeminiClientError extends Error {
  status: number;
  retryAfterSeconds: number | null;

  constructor(message: string, status: number, retryAfterSeconds: number | null = null) {
    super(message);
    this.name = "GeminiClientError";
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readRetryAfterSeconds(value: string | null) {
  if (!value) {
    return null;
  }

  const seconds = Number.parseInt(value, 10);

  if (Number.isInteger(seconds) && seconds >= 0) {
    return seconds;
  }

  const retryDate = new Date(value);
  if (Number.isNaN(retryDate.getTime())) {
    return null;
  }

  const delta = Math.ceil((retryDate.getTime() - Date.now()) / 1000);
  return delta > 0 ? delta : 0;
}

function sanitizeStatusMessage(status: number, fallback = "Gemini request failed.") {
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

  return fallback;
}

function extractTextFromResponse(body: unknown) {
  if (!isRecord(body)) {
    return null;
  }

  if (Array.isArray(body.candidates)) {
    for (const candidate of body.candidates as GeminiCandidate[]) {
      const parts = candidate.content?.parts;

      if (!Array.isArray(parts)) {
        continue;
      }

      const text = parts
        .map((part) => (typeof part.text === "string" ? part.text : ""))
        .join("")
        .trim();

      if (text) {
        return text;
      }
    }
  }

  if (typeof body.text === "string" && body.text.trim()) {
    return body.text.trim();
  }

  return null;
}

function buildGeminiEndpoint(modelName: GeminiModelName) {
  const url = new URL(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`);
  return url.toString();
}

function buildRequestParts(options: GeminiGenerateContentOptions) {
  const parts = [...(options.parts ?? [])];
  const prompt = options.prompt?.trim();

  if (prompt) {
    parts.push({ text: prompt });
  }

  if (!parts.length) {
    throw new GeminiClientError("Gemini request requires a prompt or image parts.", 400);
  }

  return parts;
}

function buildGenerationConfig(options: GeminiGenerateContentOptions) {
  return {
    temperature: options.temperature ?? 0.2,
    maxOutputTokens: options.maxOutputTokens ?? 8192,
    responseMimeType: "application/json",
    ...(options.responseJsonSchema ? { responseJsonSchema: options.responseJsonSchema } : {}),
  };
}

function buildRequestBody(options: GeminiGenerateContentOptions) {
  const systemInstruction = options.systemInstruction?.trim();

  return {
    contents: [
      {
        role: "user",
        parts: buildRequestParts(options),
      },
    ],
    ...(systemInstruction
      ? {
          systemInstruction: {
            parts: [{ text: systemInstruction }],
          },
        }
      : {}),
    generationConfig: buildGenerationConfig(options),
  };
}

export async function generateGeminiJsonText(options: GeminiGenerateContentOptions) {
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? 120_000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;

  try {
    response = await fetch(buildGeminiEndpoint(options.modelName), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": options.apiKey,
      },
      signal: controller.signal,
      body: JSON.stringify(buildRequestBody(options)),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new GeminiClientError("Gemini request timed out.", 408);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }

  const retryAfterSeconds = readRetryAfterSeconds(response.headers.get("retry-after"));

  if (!response.ok) {
    let errorStatus = response.status;
    try {
      const body = (await response.json()) as GeminiErrorResponse;
      if (typeof body.error?.code === "number") {
        errorStatus = body.error.code;
      }
    } catch {
      // Ignore response parsing failures and fall back to the HTTP status.
    }

    throw new GeminiClientError(sanitizeStatusMessage(errorStatus), errorStatus, retryAfterSeconds);
  }

  const body = (await response.json()) as unknown;
  const text = extractTextFromResponse(body);

  if (!text) {
    throw new GeminiClientError("Gemini response did not include structured text.", 502, retryAfterSeconds);
  }

  return {
    text,
    raw: body as JsonValue,
  };
}
