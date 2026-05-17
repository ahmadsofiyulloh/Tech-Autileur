import { expect, test } from "@playwright/test";
import { buildPromptPackEditorStoragePayload } from "../../src/lib/prompts/prompt-pack-contract";
import { buildFlowAssignmentPlan, type ControllerPromptPackRecord } from "../../src/lib/server/controller";
import {
  assertFlowAccountAvailableForBatchCreation,
  assertFlowBatchPromptPackReady,
  assertFlowBatchWorkspaceConstraints,
  type FlowBatchRecord,
} from "../../src/lib/server/flow-batches";
import type { FlowAccountPoolRecord } from "../../src/lib/server/flow-accounts";

function buildPromptPackFixture(overrides?: Record<string, unknown>) {
  const storagePayload = buildPromptPackEditorStoragePayload(
    {
      clips: {
        clip_1: {
          i2i_first_frame: "Clip 1 first frame prompt.",
          i2i_last_frame: "Clip 1 last frame prompt.",
          i2v_prompt: "Clip 1 video prompt.",
        },
        clip_2: {
          i2i_first_frame: "Clip 2 first frame prompt.",
          i2i_last_frame: "Clip 2 last frame prompt.",
          i2v_prompt: "Clip 2 video prompt.",
        },
      },
      caption: "Caption.",
      tags: "#tag",
    },
    {
      prompt_context: {
        product: {
          product_name: "Tas selempang",
        },
      },
      seed_character: {
        locked: false,
        notes: "",
        drive_item_ref_id: null,
      },
      environment: {
        locked: false,
        notes: "",
        drive_item_ref_id: null,
      },
    },
  );

  return {
    id: "prompt-pack-1",
    product_id: "product-1",
    status: "APPROVED",
    ...storagePayload,
    ...overrides,
  };
}

function buildWorkspaceContext() {
  return {
    currentWorkspace: {
      id: "workspace-1",
    },
    promptPack: {
      product_id: "product-1",
    },
    product: {
      id: "product-1",
      workspace_id: "workspace-1",
    },
  };
}

function buildFlowAccountFixture(overrides?: Partial<FlowAccountPoolRecord>) {
  return {
    id: "flow-account-1",
    user_id: "user-1",
    account_code: "FLOW-FREE-1",
    account_type: "FLOW_FREE",
    observed_daily_credit: 50,
    observed_monthly_credit: null,
    credit_per_generation: 10,
    max_parallel_allowed: 2,
    cooldown_minutes: 0,
    status: "ACTIVE",
    notes: null,
    created_at: "2026-05-16T00:00:00.000Z",
    updated_at: "2026-05-16T00:00:00.000Z",
    open_batch_count: 0,
    batch_credit_load: 0,
    credits_remaining: 20,
    slots_remaining: 2,
    last_batch_at: null,
    cooldown_until: null,
    cooldown_remaining_minutes: 0,
    eligibility_reasons: [],
    recommended_max_jobs: 2,
    is_available: true,
    ...overrides,
  } as FlowAccountPoolRecord;
}

test("ready prompt pack passes batch readiness validation", () => {
  expect(() =>
    assertFlowBatchPromptPackReady(
      buildPromptPackFixture() as unknown as Parameters<typeof assertFlowBatchPromptPackReady>[0],
    ),
  ).not.toThrow();
});

test("inactive prompt packs are rejected before batch creation", () => {
  const promptPack = buildPromptPackFixture({ status: "DRAFT" });

  expect(() =>
    assertFlowBatchPromptPackReady(promptPack as unknown as Parameters<typeof assertFlowBatchPromptPackReady>[0]),
  ).toThrow("Prompt pack belum siap Flow.");
});

test("incomplete prompt packs are rejected before batch creation", () => {
  const promptPack = buildPromptPackFixture();
  const i2iPrompts = promptPack.i2i_prompts_json as {
    clip_1: {
      first_frame: {
        prompt_text: string;
      };
    };
  };
  i2iPrompts.clip_1.first_frame.prompt_text = " ";

  expect(() =>
    assertFlowBatchPromptPackReady(promptPack as unknown as Parameters<typeof assertFlowBatchPromptPackReady>[0]),
  ).toThrow("Prompt pack belum lengkap.");
});

test("batch creation stays scoped to the active workspace and rejects duplicates", () => {
  const { currentWorkspace, promptPack, product } = buildWorkspaceContext();

  expect(() =>
    assertFlowBatchWorkspaceConstraints({
      currentWorkspace,
      promptPack,
      product,
      openBatchExists: false,
    }),
  ).not.toThrow();

  expect(() =>
    assertFlowBatchWorkspaceConstraints({
      currentWorkspace: {
        id: "workspace-2",
      },
      promptPack,
      product,
      openBatchExists: false,
    }),
  ).toThrow("Workspace tidak aktif.");

  expect(() =>
    assertFlowBatchWorkspaceConstraints({
      currentWorkspace,
      promptPack,
      product,
      openBatchExists: true,
    }),
  ).toThrow("Batch prompt pack sudah aktif.");
});

test("unavailable Flow accounts are rejected before batch creation", () => {
  const availableAccount = {
    status: "ACTIVE",
    observed_daily_credit: 20,
    credit_per_generation: 2,
    max_parallel_allowed: 2,
    cooldown_minutes: 0,
  };

  expect(() =>
    assertFlowAccountAvailableForBatchCreation(availableAccount, [], "2026-05-17"),
  ).not.toThrow();

  const blockedBatch: Pick<FlowBatchRecord, "status" | "max_jobs" | "target_date" | "created_at" | "updated_at"> = {
    status: "DRAFT",
    max_jobs: 2,
    target_date: "2026-05-17",
    created_at: "2026-05-17T00:00:00.000Z",
    updated_at: "2026-05-17T00:00:00.000Z",
  };

  expect(() =>
    assertFlowAccountAvailableForBatchCreation(
      {
        status: "ACTIVE",
        observed_daily_credit: 20,
        credit_per_generation: 2,
        max_parallel_allowed: 1,
        cooldown_minutes: 0,
      },
      [blockedBatch],
      "2026-05-17",
    ),
  ).toThrow("Akun Flow tidak tersedia.");
});

test("bulk batch planning skips open batches and rotates available Flow accounts", () => {
  const plan = buildFlowAssignmentPlan({
    promptPacks: [
      buildPromptPackFixture({ id: "prompt-pack-1", prompt_code: "PP-001", product_id: "product-1" }) as unknown as ControllerPromptPackRecord,
      buildPromptPackFixture({ id: "prompt-pack-2", prompt_code: "PP-002", product_id: "product-2" }) as unknown as ControllerPromptPackRecord,
      buildPromptPackFixture({ id: "prompt-pack-3", prompt_code: "PP-003", product_id: "product-3" }) as unknown as ControllerPromptPackRecord,
    ],
    accounts: [
      buildFlowAccountFixture({
        id: "flow-account-free",
        account_code: "FLOW-FREE-1",
        account_type: "FLOW_FREE",
        credits_remaining: 20,
        slots_remaining: 2,
        recommended_max_jobs: 2,
        is_available: true,
      }),
      buildFlowAccountFixture({
        id: "flow-account-plus",
        account_code: "FLOW-PLUS-1",
        account_type: "FLOW_PLUS",
        credits_remaining: 40,
        slots_remaining: 2,
        recommended_max_jobs: 4,
        is_available: true,
      }),
    ],
    existingPromptPackIds: new Set(["prompt-pack-2"]),
  });

  expect(plan).toHaveLength(3);
  expect(plan[0]).toMatchObject({
    promptPackId: "prompt-pack-1",
    status: "READY",
    recommendedAccountCode: "FLOW-FREE-1",
  });
  expect(plan[1]).toMatchObject({
    promptPackId: "prompt-pack-2",
    status: "SKIPPED",
    reason: "Sudah dipakai batch lain.",
  });
  expect(plan[2]).toMatchObject({
    promptPackId: "prompt-pack-3",
    status: "READY",
    recommendedAccountCode: "FLOW-PLUS-1",
  });
});
