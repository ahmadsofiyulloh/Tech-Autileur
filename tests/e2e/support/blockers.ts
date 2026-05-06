import { isGeminiTemporaryUnavailableMessage } from "@/lib/gemini/error-message";

export type SmokeBlockerCategory =
  | "APP_BLOCKER"
  | "AUTH_BLOCKER"
  | "SUPABASE_BLOCKER"
  | "GEMINI_BLOCKER"
  | "DRIVE_BLOCKER"
  | "HELPER_BLOCKER"
  | "FLOW_BLOCKER"
  | "ENV_BLOCKER";

export class SmokeBlockerError extends Error {
  readonly category: SmokeBlockerCategory;
  readonly stage: string;

  constructor(category: SmokeBlockerCategory, stage: string, message: string) {
    super(`[${category}] ${stage}: ${message}`);
    this.name = "SmokeBlockerError";
    this.category = category;
    this.stage = stage;
  }
}

function inferBlockerCategory(message: string): SmokeBlockerCategory {
  const text = message.toLowerCase();

  if (text.includes("app api token") || text.includes("helper callback") || text.includes("authorization header")) {
    return "HELPER_BLOCKER";
  }

  if (text.includes("gemini") || text.includes("vision") || text.includes("api key") || text.includes("ai task")) {
    return "GEMINI_BLOCKER";
  }

  if (text.includes("drive") || text.includes("google drive") || text.includes("upload") || text.includes("folder")) {
    return "DRIVE_BLOCKER";
  }

  if (text.includes("flow") || text.includes("manifest") || text.includes("chrome profile") || text.includes("batch")) {
    return "FLOW_BLOCKER";
  }

  if (text.includes("login") || text.includes("password") || text.includes("session") || text.includes("auth")) {
    return "AUTH_BLOCKER";
  }

  if (text.includes("relation") || text.includes("schema") || text.includes("supabase") || text.includes("rls")) {
    return "SUPABASE_BLOCKER";
  }

  if (text.includes("env") || text.includes("environment variable") || text.includes("missing required")) {
    return "ENV_BLOCKER";
  }

  return "APP_BLOCKER";
}

export function classifySmokeError(stage: string, error: unknown): SmokeBlockerError {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "Smoke test failed.";
  return new SmokeBlockerError(inferBlockerCategory(message), stage, message);
}

export function isControlledGeminiTemporaryUnavailableBlocker(message: string) {
  return isGeminiTemporaryUnavailableMessage(message);
}
