import { INTAKE_VISION_PROMPT_VERSION, INTAKE_VISION_SCHEMA_VERSION, parseIntakeVisionOutput } from "@/lib/intake/vision-contract";
import type { IntakeVisionParseOutput } from "@/lib/intake/vision-contract";

export function buildIntakeVisionRepairPrompt(rawText: string, repairReason?: string) {
  return [
    "Task: repair the previous Gemini response into valid JSON only.",
    `schema_version must be "${INTAKE_VISION_SCHEMA_VERSION}".`,
    `prompt_version must be "${INTAKE_VISION_PROMPT_VERSION}".`,
    "The previous output may be commentary, a JSON array, a JSON string, or a malformed object.",
    "Return one JSON object only. Never return an array, wrapper text, markdown, or code fences.",
    "Preserve the original meaning and literal OCR content when present.",
    "Do not invent missing OCR values or product facts.",
    "Keep empty strings and quality flags when evidence is missing, blurry, cropped, or unreadable.",
    "Return a single JSON object only. No markdown, code fences, or commentary.",
    `Repair reason: ${repairReason?.trim() || "schema mismatch"}.`,
    "",
    "Previous output:",
    rawText.trim(),
  ].join("\n");
}

export async function parseIntakeVisionOutputWithRepair(input: {
  rawText: string;
  repair: (input: { rawText: string; prompt: string }) => Promise<string>;
}): Promise<IntakeVisionParseOutput> {
  let firstParseError: Error | null = null;

  try {
    return parseIntakeVisionOutput(input.rawText);
  } catch (error) {
    if (error instanceof Error) {
      firstParseError = error;
    } else {
      throw error;
    }
  }

  const repairedText = await input.repair({
    rawText: input.rawText,
    prompt: buildIntakeVisionRepairPrompt(input.rawText, firstParseError?.message),
  });

  return parseIntakeVisionOutput(repairedText);
}
