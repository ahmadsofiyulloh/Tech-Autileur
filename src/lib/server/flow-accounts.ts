import "server-only";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ACCOUNT_STATUSES, type AccountStatus, isAccountStatus } from "@/lib/gemini/validation";
import { listFlowBatches, type FlowBatchRecord, type FlowBatchStatus } from "@/lib/server/flow-batches";

export const FLOW_ACCOUNT_TYPES = ["FLOW_FREE", "FLOW_PLUS"] as const;

export type FlowAccountType = (typeof FLOW_ACCOUNT_TYPES)[number];

export type FlowAccountRecord = {
  id: string;
  user_id: string;
  account_code: string;
  account_type: FlowAccountType;
  observed_daily_credit: number;
  observed_monthly_credit: number | null;
  credit_per_generation: number;
  max_parallel_allowed: number;
  cooldown_minutes: number;
  status: AccountStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type FlowAccountPoolRecord = FlowAccountRecord & {
  open_batch_count: number;
  batch_credit_load: number;
  credits_remaining: number;
  slots_remaining: number;
  recommended_max_jobs: number;
  is_available: boolean;
};

type FlowAccountInput = {
  account_code: string;
  account_type: FlowAccountType | string;
  observed_daily_credit?: number | string | null;
  observed_monthly_credit?: number | string | null;
  credit_per_generation?: number | string | null;
  max_parallel_allowed?: number | string | null;
  cooldown_minutes?: number | string | null;
  status?: AccountStatus | string;
  notes?: string | null;
};

type FlowAccountUpdateInput = Partial<FlowAccountInput>;

const OPEN_BATCH_STATUSES = new Set<FlowBatchStatus>([
  "DRAFT",
  "READY_TO_EXPORT",
  "EXPORTED",
  "RUNNING",
  "IMPORTING",
  "PARTIALLY_IMPORTED",
  "NEED_MANUAL_MATCH",
]);

function readText(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNullableText(value: string | null | undefined) {
  const trimmed = readText(value);
  return trimmed.length > 0 ? trimmed : null;
}

function parseIntField(value: number | string | null | undefined, fieldName: string, fallback: number) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  const parsed = typeof value === "number" ? value : Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${fieldName} must be a whole number greater than or equal to zero.`);
  }

  return parsed;
}

function assertAccountType(value: string): asserts value is FlowAccountType {
  if (!(FLOW_ACCOUNT_TYPES as readonly string[]).includes(value)) {
    throw new Error(`Invalid Flow account type. Expected one of: ${FLOW_ACCOUNT_TYPES.join(", ")}.`);
  }
}

function assertAccountStatus(value: string): asserts value is AccountStatus {
  if (!isAccountStatus(value)) {
    throw new Error(`Invalid account status. Expected one of: ${ACCOUNT_STATUSES.join(", ")}.`);
  }
}

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Authentication required.");
  }

  return { supabase, user };
}

async function requireOwnedFlowAccount(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  accountId: string,
) {
  const { data, error } = await supabase
    .from("flow_accounts")
    .select("*")
    .eq("id", accountId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Flow account not found.");
  }

  return data as FlowAccountRecord;
}

export async function listFlowAccounts(input?: { status?: AccountStatus | string; limit?: number }) {
  const { supabase, user } = await requireUser();

  if (input?.status) {
    assertAccountStatus(input.status);
  }

  const limit = Math.min(Math.max(input?.limit ?? 100, 1), 200);
  let query = supabase
    .from("flow_accounts")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (input?.status) {
    query = query.eq("status", input.status);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as FlowAccountRecord[];
}

export async function getFlowAccountById(id: string) {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase.from("flow_accounts").select("*").eq("id", id).eq("user_id", user.id).maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? null) as FlowAccountRecord | null;
}

export function buildFlowAccountCode(value: string) {
  const normalized = readText(value)
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized ? normalized.toUpperCase() : `FLOW-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

export async function createFlowAccount(input: FlowAccountInput) {
  const { supabase, user } = await requireUser();
  const accountType = readText(input.account_type).toUpperCase();

  assertAccountType(accountType);

  const accountCode = buildFlowAccountCode(input.account_code);
  const status = input.status ? (assertAccountStatus(input.status), input.status) : "ACTIVE";

  const { data, error } = await supabase
    .from("flow_accounts")
    .insert({
      user_id: user.id,
      account_code: accountCode,
      account_type: accountType,
      observed_daily_credit: parseIntField(input.observed_daily_credit, "observed_daily_credit", 50),
      observed_monthly_credit:
        input.observed_monthly_credit === null || input.observed_monthly_credit === undefined || input.observed_monthly_credit === ""
          ? null
          : parseIntField(input.observed_monthly_credit, "observed_monthly_credit", 0),
      credit_per_generation: Math.max(parseIntField(input.credit_per_generation, "credit_per_generation", 10), 1),
      max_parallel_allowed: Math.max(parseIntField(input.max_parallel_allowed, "max_parallel_allowed", 1), 1),
      cooldown_minutes: parseIntField(input.cooldown_minutes, "cooldown_minutes", 0),
      status,
      notes: normalizeNullableText(input.notes),
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/controller");
  return data as FlowAccountRecord;
}

export async function updateFlowAccount(id: string, input: FlowAccountUpdateInput) {
  const { supabase, user } = await requireUser();
  const current = await requireOwnedFlowAccount(supabase, user.id, id);
  const patch: Partial<FlowAccountRecord> = {};

  if (input.account_code !== undefined) {
    patch.account_code = buildFlowAccountCode(input.account_code);
  }

  if (input.account_type !== undefined) {
    const accountType = readText(input.account_type).toUpperCase();
    assertAccountType(accountType);
    patch.account_type = accountType;
  }

  if (input.observed_daily_credit !== undefined) {
    patch.observed_daily_credit = parseIntField(input.observed_daily_credit, "observed_daily_credit", current.observed_daily_credit);
  }

  if (input.observed_monthly_credit !== undefined) {
    patch.observed_monthly_credit =
      input.observed_monthly_credit === null || input.observed_monthly_credit === undefined || input.observed_monthly_credit === ""
        ? null
        : parseIntField(input.observed_monthly_credit, "observed_monthly_credit", 0);
  }

  if (input.credit_per_generation !== undefined) {
    patch.credit_per_generation = Math.max(parseIntField(input.credit_per_generation, "credit_per_generation", current.credit_per_generation), 1);
  }

  if (input.max_parallel_allowed !== undefined) {
    patch.max_parallel_allowed = Math.max(parseIntField(input.max_parallel_allowed, "max_parallel_allowed", current.max_parallel_allowed), 1);
  }

  if (input.cooldown_minutes !== undefined) {
    patch.cooldown_minutes = parseIntField(input.cooldown_minutes, "cooldown_minutes", current.cooldown_minutes);
  }

  if (input.status !== undefined) {
    assertAccountStatus(input.status);
    patch.status = input.status;
  }

  if (input.notes !== undefined) {
    patch.notes = normalizeNullableText(input.notes);
  }

  if (!Object.keys(patch).length) {
    throw new Error("No Flow account changes provided.");
  }

  const { data, error } = await supabase
    .from("flow_accounts")
    .update(patch)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/controller");
  return data as FlowAccountRecord;
}

export async function archiveFlowAccount(id: string) {
  return await updateFlowAccount(id, { status: "DISABLED" });
}

export function pickBestAvailableFlowAccount(pool: FlowAccountPoolRecord[]) {
  return pool
    .filter((account) => account.is_available)
    .sort((left, right) => {
      if (left.account_type !== right.account_type) {
        return left.account_type === "FLOW_FREE" ? -1 : 1;
      }

      if (right.credits_remaining !== left.credits_remaining) {
        return right.credits_remaining - left.credits_remaining;
      }

      if (right.slots_remaining !== left.slots_remaining) {
        return right.slots_remaining - left.slots_remaining;
      }

      return left.created_at.localeCompare(right.created_at);
    })[0] ?? null;
}

export function estimateRecommendedMaxJobs(account: FlowAccountPoolRecord) {
  if (!account.is_available) {
    return 0;
  }

  return Math.max(1, Math.min(5, Math.floor(account.credits_remaining / account.credit_per_generation)));
}

export async function getFlowAccountPool(input?: { targetDate?: string | null; limit?: number }) {
  const accounts = await listFlowAccounts({ limit: input?.limit ?? 200 });
  const targetDate = input?.targetDate?.trim() || new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
  const batches = (await listFlowBatches({ targetDate, limit: 200 })) as FlowBatchRecord[];
  const loadMap = new Map<string, { openBatchCount: number; batchCreditLoad: number }>();

  for (const batch of batches) {
    if (!OPEN_BATCH_STATUSES.has(batch.status)) {
      continue;
    }

    const current = loadMap.get(batch.flow_account_id) ?? { openBatchCount: 0, batchCreditLoad: 0 };
    current.openBatchCount += 1;
    current.batchCreditLoad += batch.max_jobs;
    loadMap.set(batch.flow_account_id, current);
  }

  return accounts
    .map<FlowAccountPoolRecord>((account) => {
      const load = loadMap.get(account.id) ?? { openBatchCount: 0, batchCreditLoad: 0 };
      const creditsUsed = load.batchCreditLoad * account.credit_per_generation;
      const creditsRemaining = Math.max(account.observed_daily_credit - creditsUsed, 0);
      const slotsRemaining = Math.max(account.max_parallel_allowed - load.openBatchCount, 0);
      const isAvailable = account.status === "ACTIVE" && slotsRemaining > 0 && creditsRemaining >= account.credit_per_generation;
      const recommendedMaxJobs = isAvailable ? Math.max(1, Math.min(5, Math.floor(creditsRemaining / account.credit_per_generation))) : 0;

      return {
        ...account,
        open_batch_count: load.openBatchCount,
        batch_credit_load: creditsUsed,
        credits_remaining: creditsRemaining,
        slots_remaining: slotsRemaining,
        recommended_max_jobs: recommendedMaxJobs,
        is_available: isAvailable,
      };
    })
    .sort((left, right) => {
      if (left.is_available !== right.is_available) {
        return left.is_available ? -1 : 1;
      }

      if (left.account_type !== right.account_type) {
        return left.account_type === "FLOW_FREE" ? -1 : 1;
      }

      if (right.credits_remaining !== left.credits_remaining) {
        return right.credits_remaining - left.credits_remaining;
      }

      if (right.slots_remaining !== left.slots_remaining) {
        return right.slots_remaining - left.slots_remaining;
      }

      return left.created_at.localeCompare(right.created_at);
    });
}

