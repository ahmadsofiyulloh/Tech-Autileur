import "server-only";

import type { GeminiUsageCard, GeminiUsageMetric, GeminiUsageOverview } from "@/lib/gemini/usage-types";
import { isGeminiModelName } from "@/lib/gemini/validation";
import { getGeminiQuotaGroupKey, hasConfiguredGeminiQuotaLimits, startOfCurrentDayInTimeZone } from "@/lib/gemini/routing";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type GeminiKeyRecord = {
  id: string;
  label: string;
  project_label: string | null;
  model_name: string;
  role: string;
  rpm_limit: number | null;
  rpd_limit: number | null;
  tpm_limit: number | null;
  status: string;
};

type GeminiUsageEventRecord = {
  gemini_api_key_id: string;
  project_label: string | null;
  model_name: string;
  request_started_at: string;
  prompt_token_count: number | null;
};

type UsageBucket = {
  rpdUsed: number;
  rpmUsed: number;
  tpmUsed: number;
};

function cleanText(value: string | null | undefined) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function usageGroupKey(input: { gemini_api_key_id?: string | null; id?: string; model_name: string; project_label: string | null }) {
  return getGeminiQuotaGroupKey({
    id: input.gemini_api_key_id ?? input.id ?? "unknown",
    model_name: input.model_name,
    project_label: input.project_label,
  });
}

function numberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function buildMetric(label: GeminiUsageMetric["label"], used: number, limit: number | null): GeminiUsageMetric {
  if (limit === null) {
    return {
      label,
      limit: null,
      remaining: null,
      used,
      percent: null,
    };
  }

  if (limit <= 0) {
    return {
      label,
      limit,
      remaining: 0,
      used,
      percent: 100,
    };
  }

  return {
    label,
    limit,
    remaining: Math.max(limit - used, 0),
    used,
    percent: Math.min(Math.round((used / limit) * 100), 100),
  };
}

function minKnownLimit(keys: GeminiKeyRecord[], field: "rpd_limit" | "rpm_limit" | "tpm_limit") {
  const values = keys
    .map((key) => numberOrNull(key[field]))
    .filter((value): value is number => value !== null);

  return values.length ? Math.min(...values) : null;
}

function hasMixedLimits(keys: GeminiKeyRecord[]) {
  return (["rpd_limit", "rpm_limit", "tpm_limit"] as const).some((field) => {
    const values = new Set(
      keys
        .map((key) => numberOrNull(key[field]))
        .filter((value): value is number => value !== null),
    );
    return values.size > 1;
  });
}

function buildCards(keys: GeminiKeyRecord[], events: GeminiUsageEventRecord[], now: Date) {
  const minuteStart = new Date(now.getTime() - 60_000);
  const groupedKeys = new Map<string, GeminiKeyRecord[]>();
  const keyGroupById = new Map<string, string>();
  const groupedUsage = new Map<string, UsageBucket>();

  for (const key of keys) {
    const groupKey = usageGroupKey(key);
    groupedKeys.set(groupKey, [...(groupedKeys.get(groupKey) ?? []), key]);
    keyGroupById.set(key.id, groupKey);
  }

  for (const event of events) {
    const groupKey = keyGroupById.get(event.gemini_api_key_id) ?? usageGroupKey(event);
    const bucket = groupedUsage.get(groupKey) ?? { rpdUsed: 0, rpmUsed: 0, tpmUsed: 0 };
    const startedAt = new Date(event.request_started_at);

    bucket.rpdUsed += 1;

    if (startedAt.getTime() >= minuteStart.getTime()) {
      bucket.rpmUsed += 1;
      bucket.tpmUsed += event.prompt_token_count ?? 0;
    }

    groupedUsage.set(groupKey, bucket);
  }

  return keys.map((key) => {
    const groupKey = usageGroupKey(key);
    const keysInGroup = groupedKeys.get(groupKey) ?? [key];
    const usage = groupedUsage.get(groupKey) ?? { rpdUsed: 0, rpmUsed: 0, tpmUsed: 0 };
    const projectLabel = cleanText(key.project_label);
    const rpdLimit = minKnownLimit(keysInGroup, "rpd_limit");
    const rpmLimit = minKnownLimit(keysInGroup, "rpm_limit");
    const tpmLimit = minKnownLimit(keysInGroup, "tpm_limit");

    return {
      id: key.id,
      label: key.label,
      modelName: key.model_name,
      role: key.role,
      status: key.status,
      projectLabel,
      groupLabel: projectLabel ? `${projectLabel} / ${key.model_name}` : `${key.label} / ${key.model_name}`,
      isProjectScoped: Boolean(projectLabel),
      hasMixedLimits: hasMixedLimits(keysInGroup),
      rpd: buildMetric("RPD", usage.rpdUsed, rpdLimit),
      rpm: buildMetric("RPM", usage.rpmUsed, rpmLimit),
      tpm: buildMetric("TPM", usage.tpmUsed, tpmLimit),
    } satisfies GeminiUsageCard;
  });
}

export async function getGeminiUsageOverview(userId: string): Promise<GeminiUsageOverview> {
  const supabase = await createSupabaseServerClient();
  const now = new Date();
  const dayStart = startOfCurrentDayInTimeZone(now);
  const { data: keys, error: keyError } = await supabase
    .from("gemini_api_keys")
    .select("id, label, project_label, model_name, role, rpm_limit, rpd_limit, tpm_limit, status")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (keyError) {
    return {
      cards: [],
      generatedAt: now.toISOString(),
      unavailableMessage: keyError.message,
    };
  }

  const geminiKeys = ((keys ?? []) as GeminiKeyRecord[]).filter(
    (key) => key.status !== "DISABLED" && isGeminiModelName(key.model_name) && hasConfiguredGeminiQuotaLimits(key),
  );
  const { data: events, error: eventError } = await supabase
    .from("gemini_api_usage_events")
    .select("gemini_api_key_id, project_label, model_name, request_started_at, prompt_token_count")
    .eq("user_id", userId)
    .gte("request_started_at", dayStart.toISOString());

  if (eventError) {
    return {
      cards: buildCards(geminiKeys, [], now),
      generatedAt: now.toISOString(),
      unavailableMessage: "Usage belum tersedia.",
    };
  }

  return {
    cards: buildCards(geminiKeys, (events ?? []) as GeminiUsageEventRecord[], now),
    generatedAt: now.toISOString(),
    unavailableMessage: null,
  };
}
