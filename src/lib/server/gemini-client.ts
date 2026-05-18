import "server-only";

import { sanitizeGeminiStatusMessage } from "@/lib/gemini/error-message";
import { supportsGeminiStructuredOutputTools, type GeminiModelName } from "@/lib/gemini/validation";

type JsonValue = string | number | boolean | null | { [key: string]: JsonValue } | JsonValue[];

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
  responseJsonSchema?: unknown;
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
  enableGoogleSearchGrounding?: boolean;
};

type GeminiCandidate = {
  content?: {
    parts?: Array<{
      text?: string;
    }>;
  };
  groundingMetadata?: unknown;
  grounding_metadata?: unknown;
};

export type GeminiGroundingSummary = {
  webSearchQueries: string[];
  sourceTitles: string[];
  supportSnippets: string[];
  sourceCount: number;
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

function compactText(value: unknown, maxLength = 240) {
  if (typeof value !== "string") {
    return "";
  }

  const compacted = value.replace(/\s+/g, " ").trim();
  return compacted.length > maxLength ? `${compacted.slice(0, Math.max(maxLength - 3, 0)).trimEnd()}...` : compacted;
}

function readStringArray(value: unknown, maxItems = 8, maxLength = 180) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((item) => compactText(item, maxLength))
        .filter((item): item is string => Boolean(item)),
    ),
  ).slice(0, maxItems);
}

function readGroundingMetadata(candidate: GeminiCandidate) {
  const metadata = candidate.groundingMetadata ?? candidate.grounding_metadata;
  return isRecord(metadata) ? metadata : null;
}

function extractGroundingSummary(body: unknown): GeminiGroundingSummary | null {
  if (!isRecord(body) || !Array.isArray(body.candidates)) {
    return null;
  }

  for (const candidate of body.candidates as GeminiCandidate[]) {
    const metadata = readGroundingMetadata(candidate);

    if (!metadata) {
      continue;
    }

    const webSearchQueries = readStringArray(metadata.webSearchQueries ?? metadata.web_search_queries, 6, 140);
    const groundingChunks = metadata.groundingChunks ?? metadata.grounding_chunks;
    const groundingSupports = metadata.groundingSupports ?? metadata.grounding_supports;
    const chunks = Array.isArray(groundingChunks) ? groundingChunks : [];
    const supports = Array.isArray(groundingSupports) ? groundingSupports : [];
    const sourceTitles = Array.from(
      new Set(
        chunks
          .map((chunk) => (isRecord(chunk) && isRecord(chunk.web) ? compactText(chunk.web.title, 180) : ""))
          .filter((title): title is string => Boolean(title)),
      ),
    ).slice(0, 8);
    const sourceCount = chunks.filter((chunk) => isRecord(chunk) && isRecord(chunk.web)).length;
    const supportSnippets = Array.from(
      new Set(
        supports
          .map((support) =>
            isRecord(support) && isRecord(support.segment) ? compactText(support.segment.text, 220) : "",
          )
          .filter((snippet): snippet is string => Boolean(snippet)),
      ),
    ).slice(0, 6);

    if (sourceCount > 0 || supportSnippets.length > 0) {
      return {
        webSearchQueries,
        sourceTitles,
        supportSnippets,
        sourceCount,
      };
    }
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

function shouldIncludeGoogleSearchGroundingTool(options: GeminiGenerateContentOptions) {
  if (!options.enableGoogleSearchGrounding) {
    return false;
  }

  if (!options.responseJsonSchema) {
    return true;
  }

  return supportsGeminiStructuredOutputTools(options.modelName);
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
    ...(shouldIncludeGoogleSearchGroundingTool(options) ? { tools: [{ google_search: {} }] } : {}),
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
    let errorMessage: string | null = null;
    try {
      const body = (await response.json()) as GeminiErrorResponse;
      if (typeof body.error?.code === "number") {
        errorStatus = body.error.code;
      }

      if (typeof body.error?.message === "string" && body.error.message.trim()) {
        errorMessage = body.error.message.trim();
      }
    } catch {
      // Ignore response parsing failures and fall back to the HTTP status.
    }

    throw new GeminiClientError(
      sanitizeGeminiStatusMessage(errorStatus, "Gemini request failed.", errorMessage),
      errorStatus,
      retryAfterSeconds,
    );
  }

  const body = (await response.json()) as unknown;
  const text = extractTextFromResponse(body);

  if (!text) {
    throw new GeminiClientError("Gemini response did not include structured text.", 502, retryAfterSeconds);
  }

  return {
    text,
    raw: body as JsonValue,
    groundingSummary: extractGroundingSummary(body),
  };
}
