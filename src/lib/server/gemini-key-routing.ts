import "server-only";

import { isGeminiModelName, type GeminiKeyRole, type GeminiModelName } from "@/lib/gemini/validation";
import {
  PROMPT_PACK_GEMINI_KEY_PRIORITY,
  VISION_GEMINI_KEY_PRIORITY,
  VISION_MODEL_NAMES,
  getGeminiQuotaGroupKey,
  hasConfiguredGeminiQuotaLimits,
  normalizeGeminiProjectLabel,
  startOfCurrentDayInTimeZone,
} from "@/lib/gemini/routing";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/admin";

export {
  PROMPT_PACK_GEMINI_KEY_PRIORITY,
  VISION_GEMINI_KEY_PRIORITY,
  getGeminiQuotaGroupKey,
  hasConfiguredGeminiQuotaLimits,
  normalizeGeminiProjectLabel,
  startOfCurrentDayInTimeZone,
};

type SupabaseServiceClient = ReturnType<typeof createSupabaseServiceRoleClient>;

export type GeminiRoutingPurpose = "VISION_ANALYSIS" | "PROMPT_PACK_GENERATION" | "PROMPT_REPAIR";

export type GeminiRoutableKey = {
  id: string;
  user_id: string;
  key_code: string;
  label: string;
  provider: string;
  google_account_label: string | null;
  project_label: string | null;
  model_name: GeminiModelName;
  role: GeminiKeyRole;
  rpm_limit: number | null;
  rpd_limit: number | null;
  tpm_limit: number | null;
  requests_today: number;
  last_used_at: string | null;
  cooldown_until: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
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

function rolesForPurpose(purpose: GeminiRoutingPurpose) {
  if (purpose === "VISION_ANALYSIS") {
    return VISION_GEMINI_KEY_PRIORITY;
  }

  if (purpose === "PROMPT_REPAIR") {
    return ["PROMPT_REPAIR", "FALLBACK"] as const satisfies readonly GeminiKeyRole[];
  }

  return PROMPT_PACK_GEMINI_KEY_PRIORITY;
}

function isVisionCapableKey(key: GeminiRoutableKey) {
  return (VISION_MODEL_NAMES as readonly string[]).includes(key.model_name);
}

function isCoolingDown(key: GeminiRoutableKey, now: Date) {
  return Boolean(key.cooldown_until && new Date(key.cooldown_until).getTime() > now.getTime());
}

function emptyUsageBucket() {
  return {
    rpdUsed: 0,
    rpmUsed: 0,
    tpmUsed: 0,
  };
}

function readLimit(value: number | null) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function minKnownLimit(keys: GeminiRoutableKey[], field: "rpd_limit" | "rpm_limit" | "tpm_limit") {
  const values = keys.map((key) => readLimit(key[field])).filter((value): value is number => value !== null);
  return values.length ? Math.min(...values) : null;
}

function isBucketWithinLimit(bucket: UsageBucket, keys: GeminiRoutableKey[]) {
  const rpdLimit = minKnownLimit(keys, "rpd_limit");
  const rpmLimit = minKnownLimit(keys, "rpm_limit");
  const tpmLimit = minKnownLimit(keys, "tpm_limit");

  return (
    rpdLimit !== null &&
    rpmLimit !== null &&
    tpmLimit !== null &&
    bucket.rpdUsed < rpdLimit &&
    bucket.rpmUsed < rpmLimit &&
    bucket.tpmUsed < tpmLimit
  );
}

function usagePressure(bucket: UsageBucket, keys: GeminiRoutableKey[]) {
  const rpdLimit = minKnownLimit(keys, "rpd_limit");
  const rpmLimit = minKnownLimit(keys, "rpm_limit");
  const tpmLimit = minKnownLimit(keys, "tpm_limit");
  const ratios = [
    rpdLimit ? bucket.rpdUsed / rpdLimit : 0,
    rpmLimit ? bucket.rpmUsed / rpmLimit : 0,
    tpmLimit ? bucket.tpmUsed / tpmLimit : 0,
  ];

  return Math.max(...ratios);
}

async function listUsageEvents(serviceClient: SupabaseServiceClient, userId: string, dayStart: Date) {
  const { data, error } = await serviceClient
    .from("gemini_api_usage_events")
    .select("gemini_api_key_id, project_label, model_name, request_started_at, prompt_token_count")
    .eq("user_id", userId)
    .gte("request_started_at", dayStart.toISOString());

  if (error) {
    return [] as GeminiUsageEventRecord[];
  }

  return (data ?? []) as GeminiUsageEventRecord[];
}

function groupKeys(keys: GeminiRoutableKey[]) {
  const groupedKeys = new Map<string, GeminiRoutableKey[]>();

  for (const key of keys) {
    const groupKey = getGeminiQuotaGroupKey(key);
    groupedKeys.set(groupKey, [...(groupedKeys.get(groupKey) ?? []), key]);
  }

  return groupedKeys;
}

function groupUsage(input: {
  events: GeminiUsageEventRecord[];
  keys: GeminiRoutableKey[];
  minuteStart: Date;
}) {
  const keyGroupById = new Map<string, string>();
  const groupedUsage = new Map<string, UsageBucket>();

  for (const key of input.keys) {
    keyGroupById.set(key.id, getGeminiQuotaGroupKey(key));
  }

  for (const event of input.events) {
    const groupKey = keyGroupById.get(event.gemini_api_key_id) ?? getGeminiQuotaGroupKey({
      id: event.gemini_api_key_id,
      model_name: event.model_name,
      project_label: event.project_label,
    });
    const bucket = groupedUsage.get(groupKey) ?? emptyUsageBucket();
    const startedAt = new Date(event.request_started_at);

    bucket.rpdUsed += 1;

    if (startedAt.getTime() >= input.minuteStart.getTime()) {
      bucket.rpmUsed += 1;
      bucket.tpmUsed += event.prompt_token_count ?? 0;
    }

    groupedUsage.set(groupKey, bucket);
  }

  return groupedUsage;
}

export async function listQuotaAwareGeminiKeys(input: {
  userId: string;
  purpose: GeminiRoutingPurpose;
  excludedQuotaGroups?: ReadonlySet<string>;
  excludedKeyIds?: ReadonlySet<string>;
  serviceClient?: SupabaseServiceClient;
  now?: Date;
}) {
  const serviceClient = input.serviceClient ?? createSupabaseServiceRoleClient();
  const now = input.now ?? new Date();
  const allowedRoles = rolesForPurpose(input.purpose);
  const { data, error } = await serviceClient
    .from("gemini_api_keys")
    .select(
      "id, user_id, key_code, label, provider, google_account_label, project_label, model_name, role, rpm_limit, rpd_limit, tpm_limit, requests_today, last_used_at, cooldown_until, status, notes, created_at, updated_at",
    )
    .eq("user_id", input.userId)
    .eq("status", "ACTIVE")
    .in("role", [...allowedRoles]);

  if (error) {
    throw new Error(error.message);
  }

  const rawKeys = ((data ?? []) as GeminiRoutableKey[]).filter((key) => {
    if (isCoolingDown(key, now)) {
      return false;
    }

    if (input.purpose === "VISION_ANALYSIS" && !isVisionCapableKey(key)) {
      return false;
    }

    return isGeminiModelName(key.model_name) && hasConfiguredGeminiQuotaLimits(key);
  });
  const groupedKeys = groupKeys(rawKeys);
  const dayStart = startOfCurrentDayInTimeZone(now);
  const minuteStart = new Date(now.getTime() - 60_000);
  const groupedUsage = groupUsage({
    events: await listUsageEvents(serviceClient, input.userId, dayStart),
    keys: rawKeys,
    minuteStart,
  });

  return rawKeys
    .filter((key) => {
      if (input.excludedKeyIds?.has(key.id)) {
        return false;
      }

      const groupKey = getGeminiQuotaGroupKey(key);
      const keysInGroup = groupedKeys.get(groupKey) ?? [key];
      const usage = groupedUsage.get(groupKey) ?? emptyUsageBucket();

      if (input.excludedQuotaGroups?.has(groupKey)) {
        return false;
      }

      return isBucketWithinLimit(usage, keysInGroup);
    })
    .sort((left, right) => {
      const leftGroupKey = getGeminiQuotaGroupKey(left);
      const rightGroupKey = getGeminiQuotaGroupKey(right);
      const leftPressure = usagePressure(groupedUsage.get(leftGroupKey) ?? emptyUsageBucket(), groupedKeys.get(leftGroupKey) ?? [left]);
      const rightPressure = usagePressure(groupedUsage.get(rightGroupKey) ?? emptyUsageBucket(), groupedKeys.get(rightGroupKey) ?? [right]);

      if (leftPressure !== rightPressure) {
        return leftPressure - rightPressure;
      }

      if (left.last_used_at !== right.last_used_at) {
        if (!left.last_used_at) {
          return -1;
        }

        if (!right.last_used_at) {
          return 1;
        }

        return new Date(left.last_used_at).getTime() - new Date(right.last_used_at).getTime();
      }

      return new Date(left.created_at).getTime() - new Date(right.created_at).getTime();
    });
}

export async function markGeminiKeySuccess(input: {
  serviceClient: SupabaseServiceClient;
  userId: string;
  key: Pick<GeminiRoutableKey, "id" | "requests_today">;
}) {
  const { error } = await input.serviceClient
    .from("gemini_api_keys")
    .update({
      requests_today: input.key.requests_today + 1,
      last_used_at: new Date().toISOString(),
      status: "ACTIVE",
      cooldown_until: null,
    })
    .eq("id", input.key.id)
    .eq("user_id", input.userId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function markGeminiQuotaGroupCooldown(input: {
  serviceClient: SupabaseServiceClient;
  userId: string;
  key: GeminiRoutableKey;
  nextStatus: "RATE_LIMITED" | "COOLDOWN";
  cooldownUntil: string | null;
}) {
  const { data, error } = await input.serviceClient
    .from("gemini_api_keys")
    .select("id, project_label, model_name")
    .eq("user_id", input.userId)
    .eq("model_name", input.key.model_name);

  if (error) {
    throw new Error(error.message);
  }

  const targetGroup = getGeminiQuotaGroupKey(input.key);
  const ids = (data ?? [])
    .filter((key) =>
      getGeminiQuotaGroupKey({
        id: key.id,
        model_name: key.model_name,
        project_label: key.project_label,
      }) === targetGroup,
    )
    .map((key) => key.id);

  const { error: updateError } = await input.serviceClient
    .from("gemini_api_keys")
    .update({
      status: input.nextStatus,
      cooldown_until: input.cooldownUntil,
    })
    .eq("user_id", input.userId)
    .in("id", ids.length ? ids : [input.key.id]);

  if (updateError) {
    throw new Error(updateError.message);
  }
}

export async function markGeminiKeyError(input: {
  serviceClient: SupabaseServiceClient;
  userId: string;
  keyId: string;
}) {
  const { error } = await input.serviceClient
    .from("gemini_api_keys")
    .update({
      status: "ERROR",
      cooldown_until: null,
    })
    .eq("user_id", input.userId)
    .eq("id", input.keyId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function markGeminiQuotaGroupError(input: {
  serviceClient: SupabaseServiceClient;
  userId: string;
  key: GeminiRoutableKey;
}) {
  const { data, error } = await input.serviceClient
    .from("gemini_api_keys")
    .select("id, project_label, model_name")
    .eq("user_id", input.userId)
    .eq("model_name", input.key.model_name);

  if (error) {
    throw new Error(error.message);
  }

  const targetGroup = getGeminiQuotaGroupKey(input.key);
  const ids = (data ?? [])
    .filter((key) =>
      getGeminiQuotaGroupKey({
        id: key.id,
        model_name: key.model_name,
        project_label: key.project_label,
      }) === targetGroup,
    )
    .map((key) => key.id);

  const { error: updateError } = await input.serviceClient
    .from("gemini_api_keys")
    .update({
      status: "ERROR",
      cooldown_until: null,
    })
    .eq("user_id", input.userId)
    .in("id", ids.length ? ids : [input.key.id]);

  if (updateError) {
    throw new Error(updateError.message);
  }
}
