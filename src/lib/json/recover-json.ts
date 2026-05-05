function extractJsonText(rawText: string) {
  const trimmed = rawText.trim();

  if (!trimmed) {
    throw new Error("Gemini output was empty.");
  }

  if (trimmed.startsWith("```")) {
    const firstNewLine = trimmed.indexOf("\n");
    const lastFence = trimmed.lastIndexOf("```");

    if (firstNewLine >= 0 && lastFence > firstNewLine) {
      const inner = trimmed.slice(firstNewLine + 1, lastFence).trim();

      if (inner) {
        return inner;
      }
    }
  }

  return trimmed;
}

function scanBalancedJsonCandidate(text: string, startIndex: number) {
  const opening = text[startIndex];
  const closing = opening === "{" ? "}" : opening === "[" ? "]" : null;

  if (!closing) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = startIndex; index < text.length; index += 1) {
    const character = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (character === "\\") {
        escaped = true;
        continue;
      }

      if (character === '"') {
        inString = false;
      }

      continue;
    }

    if (character === '"') {
      inString = true;
      continue;
    }

    if (character === opening) {
      depth += 1;
      continue;
    }

    if (character === closing) {
      depth -= 1;

      if (depth === 0) {
        return text.slice(startIndex, index + 1).trim();
      }
    }
  }

  return null;
}

function findJsonCandidate(text: string) {
  const starts = [...text.matchAll(/[{\[]/g)].map((match) => match.index ?? -1).filter((index) => index >= 0);

  for (const startIndex of starts) {
    const candidate = scanBalancedJsonCandidate(text, startIndex);

    if (!candidate) {
      continue;
    }

    try {
      JSON.parse(candidate);
      return candidate;
    } catch {
      // Try the next candidate.
    }
  }

  return null;
}

export function recoverJsonText(rawText: string) {
  const initial = extractJsonText(rawText);

  try {
    JSON.parse(initial);
    return initial;
  } catch {
    const candidate = findJsonCandidate(initial);

    if (candidate) {
      return candidate;
    }
  }

  throw new Error("Gemini output did not contain valid JSON.");
}
