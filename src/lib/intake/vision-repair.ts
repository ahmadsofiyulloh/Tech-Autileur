import { INTAKE_VISION_PROMPT_VERSION, INTAKE_VISION_SCHEMA_VERSION, parseIntakeVisionOutput } from "@/lib/intake/vision-contract";
import type { IntakeVisionParseOutput } from "@/lib/intake/vision-contract";

function isRepairableIntakeParseError(error: unknown) {
  return (
    error instanceof Error &&
    (error.message === "Gemini output did not contain valid JSON." || error.message === "Gemini output was empty.")
  );
}

export function buildIntakeVisionRepairPrompt(rawText: string) {
  return [
    "Task: repair the previous Gemini response into valid JSON only.",
    `schema_version must be "${INTAKE_VISION_SCHEMA_VERSION}".`,
    `prompt_version must be "${INTAKE_VISION_PROMPT_VERSION}".`,
    "Preserve the original meaning and literal OCR content when present.",
    "Do not invent missing OCR values or product facts.",
    "Keep empty strings and quality flags when evidence is missing, blurry, cropped, or unreadable.",
    "Return a single JSON object only. No markdown, code fences, or commentary.",
    "",
    "Previous output:",
    rawText.trim(),
  ].join("\n");
}

export async function parseIntakeVisionOutputWithRepair(input: {
  rawText: string;
  repair: (input: { rawText: string; prompt: string }) => Promise<string>;
}): Promise<IntakeVisionParseOutput> {
  try {
    return parseIntakeVisionOutput(input.rawText);
  } catch (error) {
    if (!isRepairableIntakeParseError(error)) {
      throw error;
    }
  }

  const repairedText = await input.repair({
    rawText: input.rawText,
    prompt: buildIntakeVisionRepairPrompt(input.rawText),
  });

  return parseIntakeVisionOutput(repairedText);
}
