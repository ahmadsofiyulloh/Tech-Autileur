import Link from "next/link";
import { redirect } from "next/navigation";
import { Archive, ArrowRight, FileText, HardDrive, Package, Workflow } from "lucide-react";
import { saveController } from "./actions";
import { CopyButton } from "@/components/operator/copy-button";
import { EmptyState } from "@/components/operator/empty-state";
import { FormActions } from "@/components/operator/form-actions";
import { PageHeader } from "@/components/operator/page-header";
import { SectionCard } from "@/components/operator/section-card";
import { StatusBadge } from "@/components/operator/status-badge";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  buildClipJobDraft,
  buildFlowAssignmentPlan,
  buildPromptContextSummary,
  getControllerDashboardState,
  type ControllerAssignmentPlanItem,
  type ControllerDriveItemRecord,
  type ControllerPromptPackRecord,
  type ControllerProductRecord,
} from "@/lib/server/controller";
import { ACCOUNT_STATUSES } from "@/lib/gemini/validation";
import { FLOW_ACCOUNT_TYPES, type FlowAccountPoolRecord } from "@/lib/server/flow-accounts";
import { FLOW_BATCH_STATUSES, type FlowBatchRecord } from "@/lib/server/flow-batches";
import { CLIP_JOB_STATUSES, GENERATED_FILE_MATCH_STATUSES, type ClipJobRecord, type GeneratedFileRecord } from "@/lib/server/clip-jobs";
import { type ContentRecord } from "@/lib/server/contents";

export const dynamic = "force-dynamic";

const CONTENT_STATUSES = ["DRAFT", "READY", "ACTIVE", "ARCHIVED", "ERROR"] as const;

function todayInJakarta() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readPromptText(value: unknown) {
  if (!isRecord(value)) {
    return "";
  }

  const prompt = value.prompt;
  return typeof prompt === "string" ? prompt.trim() : "";
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "Not set";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function truncate(value: string, max = 120) {
  return value.length > max ? `${value.slice(0, max - 3)}...` : value;
}

function optionList(values: readonly string[]) {
  return values.map((value) => (
    <option key={value} value={value}>
      {value}
    </option>
  ));
}

function promptPackSnippet(promptPack: ControllerPromptPackRecord) {
  const candidates = [
    readPromptText(promptPack.i2v_prompts_json?.clip_01),
    readPromptText(promptPack.i2v_prompts_json?.clip_02),
    readPromptText(promptPack.i2i_prompts_json?.clip_01_start_frame),
    readPromptText(promptPack.i2i_prompts_json?.clip_01_last_frame),
  ];

  return candidates.find((candidate): candidate is string => typeof candidate === "string" && candidate.trim().length > 0)?.trim() ?? `Prompt pack ${promptPack.prompt_code}.`;
}

function productLabel(product: ControllerProductRecord | undefined | null) {
  if (!product) {
    return "Product unavailable";
  }

  return [product.product_code, product.product_name].filter(Boolean).join(" - ");
}

function accountLabel(account: FlowAccountPoolRecord | undefined | null) {
  if (!account) {
    return "Account unavailable";
  }

  return [account.account_code, account.account_type].filter(Boolean).join(" - ");
}

function batchLabel(batch: FlowBatchRecord | undefined | null, accountMap: Map<string, FlowAccountPoolRecord>) {
  if (!batch) {
    return "Batch unavailable";
  }

  const account = accountMap.get(batch.flow_account_id);
  return [batch.batch_code, account?.account_code ?? batch.flow_account_id].filter(Boolean).join(" - ");
}

function contentLabel(
  content: ContentRecord,
  productMap: Map<string, ControllerProductRecord>,
  promptPackMap: Map<string, ControllerPromptPackRecord>,
) {
  const product = productMap.get(content.product_id);
  const promptPack = content.prompt_pack_id ? promptPackMap.get(content.prompt_pack_id) : null;

  return [content.content_code, product?.product_code ?? product?.product_name, promptPack?.prompt_code].filter(Boolean).join(" - ");
}

function driveItemLabel(item: ControllerDriveItemRecord | undefined | null) {
  if (!item) {
    return "Drive item unavailable";
  }

  return [item.name, item.drive_item_id ?? item.id, item.status].filter(Boolean).join(" - ");
}

function resolveDriveItem(id: string | null | undefined, driveItemMap: Map<string, ControllerDriveItemRecord>) {
  if (!id) {
    return null;
  }

  return driveItemMap.get(id) ?? null;
}

function promptContextLine(promptPack: ControllerPromptPackRecord) {
  return buildPromptContextSummary(promptPack);
}

function getPlanItem(planMap: Map<string, ControllerAssignmentPlanItem>, promptPackId: string) {
  return planMap.get(promptPackId) ?? null;
}

function buildClipDraftContent(content: ContentRecord, promptPack: ControllerPromptPackRecord | null) {
  return {
    ...content,
    prompt_context_summary: promptPack ? buildPromptContextSummary(promptPack) : "No persisted prompt context.",
    prompt_snippet: promptPack ? promptPackSnippet(promptPack) : content.content_code,
  };
}

function IntentButton({
  intent,
  id,
  label,
  className = "button compact",
}: {
  intent: string;
  id: string;
  label: string;
  className?: string;
}) {
  return (
    <form action={saveController}>
      <input type="hidden" name="intent" value={intent} />
      <input type="hidden" name="id" value={id} />
      <button className={className} type="submit">
        {label}
      </button>
    </form>
  );
}

export default async function ControllerPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  let state: Awaited<ReturnType<typeof getControllerDashboardState>>;

  try {
    state = await getControllerDashboardState();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load controller.";

    return (
      <SectionCard icon={Workflow} badge="Error" title="Unable to load controller." description={message}>
        <EmptyState icon={Workflow} title="Controller unavailable." description="Try again." />
      </SectionCard>
    );
  }

  const productMap = new Map(state.products.map((product) => [product.id, product]));
  const promptPackMap = new Map(state.promptPacks.map((pack) => [pack.id, pack]));
  const accountMap = new Map(state.flowAccounts.map((account) => [account.id, account]));
  const batchMap = new Map(state.flowBatches.map((batch) => [batch.id, batch]));
  const contentMap = new Map(state.contents.map((content) => [content.id, content]));
  const driveItemMap = new Map(state.driveItems.map((item) => [item.id, item]));
  const existingPromptPackIds = new Set(
    state.flowBatches.filter((batch) => batch.prompt_pack_id && batch.status !== "CLOSED").map((batch) => batch.prompt_pack_id as string),
  );
  const assignmentPlan = buildFlowAssignmentPlan({
    promptPacks: state.promptPacks,
    accounts: state.flowAccounts,
    existingPromptPackIds,
  });
  const planMap = new Map(assignmentPlan.map((item) => [item.promptPackId, item]));
  const readyPromptPacks = state.readyPromptPacks.slice(0, 12);
  const availableAccounts = state.flowAccounts.filter((account) => account.is_available);
  const openBatches = state.flowBatches.filter((batch) => batch.status !== "CLOSED");
  const pendingImports = state.generatedFiles.filter((file) => file.match_status === "UNMATCHED" || file.match_status === "NEEDS_REVIEW");
  const runningJobs = state.clipJobs.filter((job) => job.status === "RUNNING" || job.status === "IMPORTING");
  const currentWorkspaceLabel = state.currentWorkspace
    ? `${state.currentWorkspace.workspace_code} - ${state.currentWorkspace.workspace_name}`
    : "No workspace selected";

  return (
    <div className="stack">
      <PageHeader
        icon={Workflow}
        badge="Execution"
        title="Controller"
        description="Mobile control hub for global Flow tools, queue assignment, batch execution, and import tracking."
        actions={
          <FormActions>
            <form action={saveController}>
              <input type="hidden" name="intent" value="auto_assign_ready_prompt_packs" />
              <input type="hidden" name="target_date" value={todayInJakarta()} />
              <button className="button primary" type="submit" disabled={!readyPromptPacks.length || !availableAccounts.length}>
                Auto-assign queue
              </button>
            </form>
          </FormActions>
        }
        stats={[
          { label: "Workspace", value: currentWorkspaceLabel },
          { label: "Ready packs", value: readyPromptPacks.length },
          { label: "Available accounts", value: availableAccounts.length },
          { label: "Open batches", value: openBatches.length },
          { label: "Running jobs", value: runningJobs.length },
          { label: "Pending imports", value: pendingImports.length },
        ]}
      />

      <section className="grid two-up">
        <SectionCard
          icon={Workflow}
          title="Flow tool pool"
          description="Global Flow accounts stay outside workspace scope and are selected by availability, credit, and status."
        >
          <details className="stack">
            <summary>Add Flow account</summary>
            <form className="stack" action={saveController}>
              <input type="hidden" name="intent" value="create_flow_account" />
              <div className="grid two-up">
                <label className="stack auth-field" htmlFor="account_code">
                  <span>Account code</span>
                  <input id="account_code" name="account_code" type="text" placeholder="FLOW_FREE_01" required />
                </label>
                <label className="stack auth-field" htmlFor="account_type">
                  <span>Account type</span>
                  <select id="account_type" name="account_type" defaultValue="FLOW_FREE" required>
                    {optionList(FLOW_ACCOUNT_TYPES)}
                  </select>
                </label>
              </div>
              <div className="grid two-up">
                <label className="stack auth-field" htmlFor="observed_daily_credit">
                  <span>Daily credit</span>
                  <input id="observed_daily_credit" name="observed_daily_credit" type="number" min={0} defaultValue={50} />
                </label>
                <label className="stack auth-field" htmlFor="observed_monthly_credit">
                  <span>Monthly credit</span>
                  <input id="observed_monthly_credit" name="observed_monthly_credit" type="number" min={0} placeholder="Optional" />
                </label>
              </div>
              <div className="grid two-up">
                <label className="stack auth-field" htmlFor="credit_per_generation">
                  <span>Credit per generation</span>
                  <input id="credit_per_generation" name="credit_per_generation" type="number" min={1} defaultValue={10} />
                </label>
                <label className="stack auth-field" htmlFor="max_parallel_allowed">
                  <span>Max parallel</span>
                  <input id="max_parallel_allowed" name="max_parallel_allowed" type="number" min={1} defaultValue={1} />
                </label>
              </div>
              <div className="grid two-up">
                <label className="stack auth-field" htmlFor="cooldown_minutes">
                  <span>Cooldown minutes</span>
                  <input id="cooldown_minutes" name="cooldown_minutes" type="number" min={0} defaultValue={0} />
                </label>
                <label className="stack auth-field" htmlFor="flow-account-status">
                  <span>Status</span>
                  <select id="flow-account-status" name="status" defaultValue="ACTIVE">
                    {optionList(ACCOUNT_STATUSES)}
                  </select>
                </label>
              </div>
              <label className="stack auth-field" htmlFor="flow-account-notes">
                <span>Notes</span>
                <textarea id="flow-account-notes" name="notes" rows={3} placeholder="Optional operator notes" />
              </label>
              <FormActions>
                <button className="button primary" type="submit">
                  Create account
                </button>
              </FormActions>
            </form>
          </details>

          {state.flowAccounts.length ? (
            <ul className="list">
              {state.flowAccounts.map((account) => (
                <li key={account.id}>
                  <div className="stack-tight">
                    <strong>{account.account_code}</strong>
                    <span className="subtle">
                      {[account.account_type, `${account.credits_remaining} credits left`, `${account.open_batch_count} open batch(es)`].join(" - ")}
                    </span>
                    <div className="section-card__actions">
                      <StatusBadge status={account.status} />
                      <StatusBadge status={account.is_available ? "AVAILABLE" : "BUSY"} tone={account.is_available ? "success" : "warning"} />
                    </div>
                    <div className="metric-grid">
                      <div className="metric">
                        <span>Recommended jobs</span>
                        <strong>{account.recommended_max_jobs}</strong>
                      </div>
                      <div className="metric">
                        <span>Parallel slots</span>
                        <strong>{account.slots_remaining}</strong>
                      </div>
                      <div className="metric">
                        <span>Daily load</span>
                        <strong>{account.batch_credit_load}</strong>
                      </div>
                    </div>
                  </div>

                  <details className="stack">
                    <summary>Edit account</summary>
                    <form className="stack" action={saveController}>
                      <input type="hidden" name="intent" value="update_flow_account" />
                      <input type="hidden" name="id" value={account.id} />
                      <div className="grid two-up">
                        <label className="stack auth-field" htmlFor={`account-code-${account.id}`}>
                          <span>Account code</span>
                          <input id={`account-code-${account.id}`} name="account_code" type="text" defaultValue={account.account_code} required />
                        </label>
                        <label className="stack auth-field" htmlFor={`account-type-${account.id}`}>
                          <span>Account type</span>
                          <select id={`account-type-${account.id}`} name="account_type" defaultValue={account.account_type} required>
                            {optionList(FLOW_ACCOUNT_TYPES)}
                          </select>
                        </label>
                      </div>
                      <div className="grid two-up">
                        <label className="stack auth-field" htmlFor={`daily-credit-${account.id}`}>
                          <span>Daily credit</span>
                          <input id={`daily-credit-${account.id}`} name="observed_daily_credit" type="number" min={0} defaultValue={account.observed_daily_credit} />
                        </label>
                        <label className="stack auth-field" htmlFor={`monthly-credit-${account.id}`}>
                          <span>Monthly credit</span>
                          <input
                            id={`monthly-credit-${account.id}`}
                            name="observed_monthly_credit"
                            type="number"
                            min={0}
                            defaultValue={account.observed_monthly_credit ?? ""}
                          />
                        </label>
                      </div>
                      <div className="grid two-up">
                        <label className="stack auth-field" htmlFor={`credit-per-generation-${account.id}`}>
                          <span>Credit per generation</span>
                          <input id={`credit-per-generation-${account.id}`} name="credit_per_generation" type="number" min={1} defaultValue={account.credit_per_generation} />
                        </label>
                        <label className="stack auth-field" htmlFor={`max-parallel-${account.id}`}>
                          <span>Max parallel</span>
                          <input id={`max-parallel-${account.id}`} name="max_parallel_allowed" type="number" min={1} defaultValue={account.max_parallel_allowed} />
                        </label>
                      </div>
                      <div className="grid two-up">
                        <label className="stack auth-field" htmlFor={`cooldown-${account.id}`}>
                          <span>Cooldown minutes</span>
                          <input id={`cooldown-${account.id}`} name="cooldown_minutes" type="number" min={0} defaultValue={account.cooldown_minutes} />
                        </label>
                        <label className="stack auth-field" htmlFor={`status-${account.id}`}>
                          <span>Status</span>
                          <select id={`status-${account.id}`} name="status" defaultValue={account.status}>
                            {optionList(ACCOUNT_STATUSES)}
                          </select>
                        </label>
                      </div>
                      <label className="stack auth-field" htmlFor={`notes-${account.id}`}>
                        <span>Notes</span>
                        <textarea id={`notes-${account.id}`} name="notes" rows={3} defaultValue={account.notes ?? ""} />
                      </label>
                      <FormActions>
                        <button className="button primary" type="submit">
                          Save account
                        </button>
                      </FormActions>
                    </form>
                    <div className="section-card__actions">
                      <IntentButton intent="archive_flow_account" id={account.id} label="Disable" />
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={Workflow} title="No Flow accounts yet." description="Add a global Flow tool to start queue assignment." />
          )}
        </SectionCard>

        <SectionCard
          icon={FileText}
          title="Ready prompt queue"
          description="Ready prompt packs are assigned to available Flow accounts without touching Sprint 14 personalization logic."
        >
          {readyPromptPacks.length ? (
            <ul className="list">
              {readyPromptPacks.map((promptPack) => {
                const product = productMap.get(promptPack.product_id);
                const plan = getPlanItem(planMap, promptPack.id);
                const promptContext = promptContextLine(promptPack);
                const promptSnippet = truncate(promptPackSnippet(promptPack), 180);
                const canQueue = Boolean(plan && plan.status === "READY" && plan.recommendedAccountId && product);

                return (
                  <li key={promptPack.id}>
                    <div className="stack-tight">
                      <strong>{promptPack.prompt_code}</strong>
                      <span className="subtle">
                        {[productLabel(product), `v${promptPack.version}`, promptContext].filter(Boolean).join(" - ")}
                      </span>
                      <p className="subtle">{promptSnippet}</p>
                      <div className="section-card__actions">
                        <StatusBadge status={promptPack.status} />
                        {plan ? (
                          plan.status === "READY" ? (
                            <>
                              <StatusBadge status={plan.recommendedAccountCode ?? "Assigned"} tone="success" />
                              <StatusBadge status={`${plan.recommendedMaxJobs} jobs`} tone="info" />
                            </>
                          ) : (
                            <StatusBadge status={plan.reason} tone="warning" />
                          )
                        ) : null}
                        {product ? (
                          <Link className="button compact" href={`/products/${product.id}`}>
                            <ArrowRight size={15} aria-hidden="true" />
                            Product
                          </Link>
                        ) : null}
                        <CopyButton text={promptSnippet} label="Copy prompt" />
                      </div>
                    </div>

                    <form className="stack" action={saveController}>
                      <input type="hidden" name="intent" value="create_flow_batch" />
                      <input type="hidden" name="workspace_id" value={product?.workspace_id ?? state.currentWorkspace?.id ?? ""} />
                      <input type="hidden" name="product_id" value={promptPack.product_id} />
                      <input type="hidden" name="prompt_pack_id" value={promptPack.id} />
                      <input type="hidden" name="flow_account_id" value={plan?.status === "READY" ? plan.recommendedAccountId : ""} />
                      <input type="hidden" name="target_date" value={todayInJakarta()} />
                      <input type="hidden" name="status" value="READY_TO_EXPORT" />
                      <input type="hidden" name="max_jobs" value={plan?.status === "READY" ? plan.recommendedMaxJobs : 1} />
                      <input type="hidden" name="model" value="google-flow" />
                      <button className="button compact primary" type="submit" disabled={!canQueue}>
                        Queue batch
                      </button>
                    </form>

                    {plan && plan.status === "SKIPPED" ? <p className="subtle">{plan.reason}</p> : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState icon={FileText} title="No ready prompts." description="Generated packs will appear here for assignment." />
          )}
        </SectionCard>
      </section>

      <SectionCard icon={HardDrive} title="Execution batches" description="Batch control for export, running, import, and closeout states.">
        {state.flowBatches.length ? (
          <ul className="list">
            {state.flowBatches.map((batch) => {
              const account = accountMap.get(batch.flow_account_id);
              const product = batch.product_id ? productMap.get(batch.product_id) : null;
              const promptPack = batch.prompt_pack_id ? promptPackMap.get(batch.prompt_pack_id) : null;
              const outputFolderItem = batch.drive_output_folder_id ? resolveDriveItem(batch.drive_output_folder_id, driveItemMap) : null;

              return (
                <li key={batch.id}>
                  <div className="stack-tight">
                    <strong>{batch.batch_code}</strong>
                    <span className="subtle">
                      {[batch.target_date, accountLabel(account), productLabel(product), promptPack?.prompt_code].filter(Boolean).join(" - ")}
                    </span>
                    <div className="section-card__actions">
                      <StatusBadge status={batch.status} />
                      {outputFolderItem ? <StatusBadge status={`Drive: ${outputFolderItem.name}`} tone="info" /> : null}
                      {batch.drive_output_folder_url ? (
                        <Link className="button compact" href={batch.drive_output_folder_url} target="_blank" rel="noreferrer">
                          <HardDrive size={15} aria-hidden="true" />
                          Open folder
                        </Link>
                      ) : null}
                    </div>
                    <p className="subtle">
                      Max jobs {batch.max_jobs} - Model {batch.model}
                    </p>
                  </div>

                  <details className="stack">
                    <summary>Edit batch</summary>
                    <form className="stack" action={saveController}>
                      <input type="hidden" name="intent" value="update_flow_batch" />
                      <input type="hidden" name="id" value={batch.id} />
                      <div className="grid two-up">
                        <label className="stack auth-field" htmlFor={`batch-status-${batch.id}`}>
                          <span>Status</span>
                          <select id={`batch-status-${batch.id}`} name="status" defaultValue={batch.status}>
                            {optionList(FLOW_BATCH_STATUSES)}
                          </select>
                        </label>
                        <label className="stack auth-field" htmlFor={`batch-max-jobs-${batch.id}`}>
                          <span>Max jobs</span>
                          <input id={`batch-max-jobs-${batch.id}`} name="max_jobs" type="number" min={1} max={5} defaultValue={batch.max_jobs} />
                        </label>
                      </div>
                      <div className="grid two-up">
                        <label className="stack auth-field" htmlFor={`batch-code-${batch.id}`}>
                          <span>Batch code</span>
                          <input id={`batch-code-${batch.id}`} name="batch_code" type="text" defaultValue={batch.batch_code} />
                        </label>
                        <label className="stack auth-field" htmlFor={`batch-target-date-${batch.id}`}>
                          <span>Target date</span>
                          <input id={`batch-target-date-${batch.id}`} name="target_date" type="text" defaultValue={batch.target_date} />
                        </label>
                      </div>
                      <div className="grid two-up">
                        <label className="stack auth-field" htmlFor={`batch-model-${batch.id}`}>
                          <span>Model</span>
                          <input id={`batch-model-${batch.id}`} name="model" type="text" defaultValue={batch.model} />
                        </label>
                        <label className="stack auth-field" htmlFor={`batch-flow-account-${batch.id}`}>
                          <span>Flow account</span>
                          <select id={`batch-flow-account-${batch.id}`} name="flow_account_id" defaultValue={batch.flow_account_id}>
                            {state.flowAccounts.map((account) => (
                              <option key={account.id} value={account.id}>
                                {account.account_code} - {account.account_type}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <div className="grid two-up">
                        <label className="stack auth-field" htmlFor={`batch-folder-url-${batch.id}`}>
                          <span>Drive output folder URL</span>
                          <input id={`batch-folder-url-${batch.id}`} name="drive_output_folder_url" type="url" defaultValue={batch.drive_output_folder_url ?? ""} />
                        </label>
                        <label className="stack auth-field" htmlFor={`batch-folder-id-${batch.id}`}>
                          <span>Drive output folder id</span>
                          <input id={`batch-folder-id-${batch.id}`} name="drive_output_folder_id" type="text" defaultValue={batch.drive_output_folder_id ?? ""} />
                        </label>
                      </div>
                      <FormActions>
                        <button className="button primary" type="submit">
                          Save batch
                        </button>
                      </FormActions>
                    </form>
                    <div className="section-card__actions">
                      <IntentButton intent="archive_flow_batch" id={batch.id} label="Close batch" />
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState icon={HardDrive} title="No execution batches yet." description="Queue a prompt pack to create the first controller batch." />
        )}
      </SectionCard>

      <SectionCard icon={Package} title="Content grouping" description="Supporting content rows keep prompt packs, batches, and clip jobs aligned.">
        {state.products.length ? (
          <details className="stack">
            <summary>Create content row</summary>
            <form className="stack" action={saveController}>
              <input type="hidden" name="intent" value="create_content" />
              <div className="grid two-up">
                <label className="stack auth-field" htmlFor="content-product-id">
                  <span>Product</span>
                  <select id="content-product-id" name="product_id" defaultValue={state.products[0]?.id ?? ""} required>
                    {state.products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.product_code} - {product.product_name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="stack auth-field" htmlFor="content-code">
                  <span>Content code</span>
                  <input id="content-code" name="content_code" type="text" placeholder="Optional auto-generated code" />
                </label>
              </div>
              <div className="grid two-up">
                <label className="stack auth-field" htmlFor="content-prompt-pack">
                  <span>Prompt pack id</span>
                  <input id="content-prompt-pack" name="prompt_pack_id" type="text" placeholder="Optional prompt pack row id" />
                </label>
                <label className="stack auth-field" htmlFor="content-platform">
                  <span>Platform</span>
                  <input id="content-platform" name="platform" type="text" placeholder="TikTok / Shopee / Other" />
                </label>
              </div>
              <div className="grid two-up">
                <label className="stack auth-field" htmlFor="content-hook">
                  <span>Hook type</span>
                  <input id="content-hook" name="hook_type" type="text" placeholder="Hook type" />
                </label>
                <label className="stack auth-field" htmlFor="content-angle">
                  <span>Angle</span>
                  <input id="content-angle" name="angle" type="text" placeholder="Angle" />
                </label>
              </div>
              <div className="grid two-up">
                <label className="stack auth-field" htmlFor="content-caption-tt">
                  <span>TikTok caption</span>
                  <input id="content-caption-tt" name="caption_tiktok" type="text" placeholder="Optional caption" />
                </label>
                <label className="stack auth-field" htmlFor="content-caption-shopee">
                  <span>Shopee caption</span>
                  <input id="content-caption-shopee" name="caption_shopee" type="text" placeholder="Optional caption" />
                </label>
              </div>
              <label className="stack auth-field" htmlFor="content-status-create">
                <span>Status</span>
                <select id="content-status-create" name="status" defaultValue="READY">
                  {optionList(CONTENT_STATUSES)}
                </select>
              </label>
              <FormActions>
                <button className="button primary" type="submit">
                  Create content
                </button>
              </FormActions>
            </form>
          </details>
        ) : null}

        {state.contents.length ? (
          <ul className="list">
            {state.contents.map((content) => {
              const product = productMap.get(content.product_id);
              const promptPack = content.prompt_pack_id ? promptPackMap.get(content.prompt_pack_id) : null;
              const promptContext = promptPack ? promptContextLine(promptPack) : "No persisted prompt context.";
              const contentJobs = state.clipJobs.filter((job) => job.content_id === content.id);
              const draft = buildClipJobDraft({
                content: buildClipDraftContent(content, promptPack ?? null),
                promptPack: promptPack ?? null,
                batch: null,
              });

              return (
                <li key={content.id}>
                  <div className="stack-tight">
                    <strong>{content.content_code}</strong>
                    <span className="subtle">
                      {[productLabel(product), promptPack?.prompt_code, content.platform, content.hook_type, content.angle].filter(Boolean).join(" - ")}
                    </span>
                    <div className="section-card__actions">
                      <StatusBadge status={content.status} />
                      <StatusBadge status={`${contentJobs.length} clip job(s)`} tone="info" />
                      <CopyButton text={content.content_code} label="Copy code" />
                    </div>
                    <p className="subtle">{promptContext}</p>
                  </div>

                  <details className="stack">
                    <summary>Edit content</summary>
                    <form className="stack" action={saveController}>
                      <input type="hidden" name="intent" value="update_content" />
                      <input type="hidden" name="id" value={content.id} />
                      <div className="grid two-up">
                        <label className="stack auth-field" htmlFor={`content-product-${content.id}`}>
                          <span>Product</span>
                          <select id={`content-product-${content.id}`} name="product_id" defaultValue={content.product_id}>
                            {state.products.map((productOption) => (
                              <option key={productOption.id} value={productOption.id}>
                                {productOption.product_code} - {productOption.product_name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="stack auth-field" htmlFor={`content-status-${content.id}`}>
                          <span>Status</span>
                          <select id={`content-status-${content.id}`} name="status" defaultValue={content.status}>
                            {optionList(CONTENT_STATUSES)}
                          </select>
                        </label>
                      </div>
                      <div className="grid two-up">
                        <label className="stack auth-field" htmlFor={`content-code-${content.id}`}>
                          <span>Content code</span>
                          <input id={`content-code-${content.id}`} name="content_code" type="text" defaultValue={content.content_code} />
                        </label>
                        <label className="stack auth-field" htmlFor={`content-prompt-${content.id}`}>
                          <span>Prompt pack id</span>
                          <input id={`content-prompt-${content.id}`} name="prompt_pack_id" type="text" defaultValue={content.prompt_pack_id ?? ""} />
                        </label>
                      </div>
                      <div className="grid two-up">
                        <label className="stack auth-field" htmlFor={`content-platform-${content.id}`}>
                          <span>Platform</span>
                          <input id={`content-platform-${content.id}`} name="platform" type="text" defaultValue={content.platform ?? ""} />
                        </label>
                        <label className="stack auth-field" htmlFor={`content-hook-${content.id}`}>
                          <span>Hook type</span>
                          <input id={`content-hook-${content.id}`} name="hook_type" type="text" defaultValue={content.hook_type ?? ""} />
                        </label>
                      </div>
                      <div className="grid two-up">
                        <label className="stack auth-field" htmlFor={`content-angle-${content.id}`}>
                          <span>Angle</span>
                          <input id={`content-angle-${content.id}`} name="angle" type="text" defaultValue={content.angle ?? ""} />
                        </label>
                        <label className="stack auth-field" htmlFor={`content-caption-${content.id}`}>
                          <span>TikTok caption</span>
                          <input id={`content-caption-${content.id}`} name="caption_tiktok" type="text" defaultValue={content.caption_tiktok ?? ""} />
                        </label>
                      </div>
                      <label className="stack auth-field" htmlFor={`content-caption-shopee-${content.id}`}>
                        <span>Shopee caption</span>
                        <input
                          id={`content-caption-shopee-${content.id}`}
                          name="caption_shopee"
                          type="text"
                          defaultValue={content.caption_shopee ?? ""}
                        />
                      </label>
                      <FormActions>
                        <button className="button primary" type="submit">
                          Save content
                        </button>
                      </FormActions>
                    </form>
                    <div className="section-card__actions">
                      <IntentButton intent="archive_content" id={content.id} label="Archive content" />
                    </div>
                  </details>

                  <details className="stack">
                    <summary>Create clip job</summary>
                    <form className="stack" action={saveController}>
                      <input type="hidden" name="intent" value="create_clip_job" />
                      <input type="hidden" name="content_id" value={content.id} />
                      {content.prompt_pack_id ? <input type="hidden" name="prompt_pack_id" value={content.prompt_pack_id} /> : null}
                      <div className="grid two-up">
                        <label className="stack auth-field" htmlFor={`clip-batch-${content.id}`}>
                          <span>Batch</span>
                          <select id={`clip-batch-${content.id}`} name="batch_id" defaultValue="">
                            <option value="">No batch</option>
                            {state.flowBatches.map((batch) => (
                              <option key={batch.id} value={batch.id}>
                                {batch.batch_code} - {batch.status}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="stack auth-field" htmlFor={`clip-status-${content.id}`}>
                          <span>Status</span>
                          <select id={`clip-status-${content.id}`} name="status" defaultValue="READY">
                            {optionList(CLIP_JOB_STATUSES)}
                          </select>
                        </label>
                      </div>
                      <div className="grid two-up">
                        <label className="stack auth-field" htmlFor={`clip-job-code-${content.id}`}>
                          <span>Job code</span>
                          <input id={`clip-job-code-${content.id}`} name="job_code" type="text" placeholder="Optional auto-generated job code" />
                        </label>
                        <label className="stack auth-field" htmlFor={`clip-code-${content.id}`}>
                          <span>Clip code</span>
                          <input id={`clip-code-${content.id}`} name="clip_code" type="text" placeholder="Optional auto-generated clip code" />
                        </label>
                      </div>
                      <div className="grid two-up">
                        <label className="stack auth-field" htmlFor={`clip-prefix-${content.id}`}>
                          <span>Prompt prefix</span>
                          <input id={`clip-prefix-${content.id}`} name="prompt_prefix" type="text" defaultValue={draft.prompt_prefix} />
                        </label>
                        <label className="stack auth-field" htmlFor={`clip-version-${content.id}`}>
                          <span>Version</span>
                          <input id={`clip-version-${content.id}`} name="version" type="text" defaultValue="V01" />
                        </label>
                      </div>
                      <label className="stack auth-field" htmlFor={`clip-paragraph-${content.id}`}>
                        <span>Prompt paragraph</span>
                        <textarea id={`clip-paragraph-${content.id}`} name="prompt_one_paragraph" rows={4} defaultValue={draft.prompt_one_paragraph} />
                      </label>
                      <div className="grid two-up">
                        <label className="stack auth-field" htmlFor={`clip-start-${content.id}`}>
                          <span>Start frame Drive item id</span>
                          <input id={`clip-start-${content.id}`} name="start_frame_drive_item_id" type="text" placeholder="Optional Drive row id" />
                        </label>
                        <label className="stack auth-field" htmlFor={`clip-last-${content.id}`}>
                          <span>Last frame Drive item id</span>
                          <input id={`clip-last-${content.id}`} name="last_frame_drive_item_id" type="text" placeholder="Optional Drive row id" />
                        </label>
                      </div>
                      <label className="stack auth-field" htmlFor={`clip-generated-${content.id}`}>
                        <span>Generated Drive item id</span>
                        <input id={`clip-generated-${content.id}`} name="generated_drive_item_id" type="text" placeholder="Optional Drive row id" />
                      </label>
                      <FormActions>
                        <button className="button primary" type="submit">
                          Create clip job
                        </button>
                      </FormActions>
                    </form>
                  </details>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState icon={Package} title="No content rows yet." description="Create a content grouping before seeding clip jobs." />
        )}
      </SectionCard>

      <section className="grid two-up">
        <SectionCard icon={FileText} title="Clip jobs" description="Prompt draft and execution state for each clip.">
          {state.clipJobs.length ? (
            <ul className="list">
              {state.clipJobs.map((job) => {
                const content = contentMap.get(job.content_id);
                const promptPack = job.prompt_pack_id ? promptPackMap.get(job.prompt_pack_id) : null;
                const batch = job.batch_id ? batchMap.get(job.batch_id) : null;
                const startFrame = resolveDriveItem(job.start_frame_drive_item_id, driveItemMap);
                const generatedFrame = resolveDriveItem(job.generated_drive_item_id, driveItemMap);
                const promptPreview = truncate(job.prompt_one_paragraph, 180);

                return (
                  <li key={job.id}>
                    <div className="stack-tight">
                      <strong>{job.job_code}</strong>
                      <span className="subtle">
                        {[job.clip_code, content ? contentLabel(content, productMap, promptPackMap) : null, batch ? batch.batch_code : null]
                          .filter(Boolean)
                          .join(" - ")}
                      </span>
                      <p className="subtle">{truncate(job.prompt_prefix, 120)}</p>
                      <p className="subtle">{promptPreview}</p>
                      <div className="section-card__actions">
                        <StatusBadge status={job.status} />
                        {startFrame ? <StatusBadge status={`Start: ${startFrame.name}`} tone="info" /> : null}
                        {generatedFrame ? <StatusBadge status={`Output: ${generatedFrame.name}`} tone="success" /> : null}
                        <CopyButton text={job.prompt_one_paragraph} label="Copy prompt" />
                      </div>
                    </div>

                    <details className="stack">
                      <summary>Edit clip job</summary>
                      <form className="stack" action={saveController}>
                        <input type="hidden" name="intent" value="update_clip_job" />
                        <input type="hidden" name="id" value={job.id} />
                        <div className="grid two-up">
                          <label className="stack auth-field" htmlFor={`job-status-${job.id}`}>
                            <span>Status</span>
                            <select id={`job-status-${job.id}`} name="status" defaultValue={job.status}>
                              {optionList(CLIP_JOB_STATUSES)}
                            </select>
                          </label>
                          <label className="stack auth-field" htmlFor={`job-version-${job.id}`}>
                            <span>Version</span>
                            <input id={`job-version-${job.id}`} name="version" type="text" defaultValue={job.version} />
                          </label>
                        </div>
                      <div className="grid two-up">
                        <label className="stack auth-field" htmlFor={`job-content-${job.id}`}>
                          <span>Content id</span>
                          <input id={`job-content-${job.id}`} name="content_id" type="text" defaultValue={job.content_id} />
                        </label>
                        <label className="stack auth-field" htmlFor={`job-batch-${job.id}`}>
                          <span>Batch id</span>
                          <input id={`job-batch-${job.id}`} name="batch_id" type="text" defaultValue={job.batch_id ?? ""} />
                        </label>
                      </div>
                      <label className="stack auth-field" htmlFor={`job-prompt-pack-${job.id}`}>
                        <span>Prompt pack id</span>
                        <input id={`job-prompt-pack-${job.id}`} name="prompt_pack_id" type="text" defaultValue={job.prompt_pack_id ?? ""} />
                      </label>
                      <div className="grid two-up">
                        <label className="stack auth-field" htmlFor={`job-code-${job.id}`}>
                          <span>Job code</span>
                          <input id={`job-code-${job.id}`} name="job_code" type="text" defaultValue={job.job_code} />
                        </label>
                          <label className="stack auth-field" htmlFor={`clip-code-edit-${job.id}`}>
                            <span>Clip code</span>
                            <input id={`clip-code-edit-${job.id}`} name="clip_code" type="text" defaultValue={job.clip_code} />
                          </label>
                        </div>
                        <label className="stack auth-field" htmlFor={`job-prefix-${job.id}`}>
                          <span>Prompt prefix</span>
                          <input id={`job-prefix-${job.id}`} name="prompt_prefix" type="text" defaultValue={job.prompt_prefix} />
                        </label>
                        <label className="stack auth-field" htmlFor={`job-paragraph-${job.id}`}>
                          <span>Prompt paragraph</span>
                          <textarea id={`job-paragraph-${job.id}`} name="prompt_one_paragraph" rows={4} defaultValue={job.prompt_one_paragraph} />
                        </label>
                        <div className="grid two-up">
                          <label className="stack auth-field" htmlFor={`job-start-${job.id}`}>
                            <span>Start frame Drive item id</span>
                            <input id={`job-start-${job.id}`} name="start_frame_drive_item_id" type="text" defaultValue={job.start_frame_drive_item_id ?? ""} />
                          </label>
                          <label className="stack auth-field" htmlFor={`job-last-${job.id}`}>
                            <span>Last frame Drive item id</span>
                            <input id={`job-last-${job.id}`} name="last_frame_drive_item_id" type="text" defaultValue={job.last_frame_drive_item_id ?? ""} />
                          </label>
                        </div>
                        <label className="stack auth-field" htmlFor={`job-generated-${job.id}`}>
                          <span>Generated Drive item id</span>
                          <input id={`job-generated-${job.id}`} name="generated_drive_item_id" type="text" defaultValue={job.generated_drive_item_id ?? ""} />
                        </label>
                        <FormActions>
                          <button className="button primary" type="submit">
                            Save clip job
                          </button>
                        </FormActions>
                      </form>
                      <div className="section-card__actions">
                        <IntentButton intent="archive_clip_job" id={job.id} label="Archive clip job" />
                      </div>
                    </details>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState icon={FileText} title="No clip jobs yet." description="Seed jobs from content rows after creating a batch." />
          )}
        </SectionCard>

        <SectionCard icon={Archive} title="Generated files" description="Import matching and status tracking for Drive outputs.">
          <details className="stack">
            <summary>Record generated file</summary>
            <form className="stack" action={saveController}>
              <input type="hidden" name="intent" value="create_generated_file" />
              <div className="grid two-up">
                <label className="stack auth-field" htmlFor="generated-clip-job">
                  <span>Clip job id</span>
                  <input id="generated-clip-job" name="clip_job_id" type="text" placeholder="Optional clip job row id" />
                </label>
                <label className="stack auth-field" htmlFor="generated-drive-item">
                  <span>Drive item id</span>
                  <input id="generated-drive-item" name="drive_item_id" type="text" placeholder="Drive row id" required />
                </label>
              </div>
              <div className="grid two-up">
                <label className="stack auth-field" htmlFor="generated-file-name">
                  <span>File name</span>
                  <input id="generated-file-name" name="file_name" type="text" placeholder="Optional file name" />
                </label>
                <label className="stack auth-field" htmlFor="generated-detected-prefix">
                  <span>Detected prefix</span>
                  <input id="generated-detected-prefix" name="detected_prefix" type="text" placeholder="Optional prefix" />
                </label>
              </div>
              <div className="grid two-up">
                <label className="stack auth-field" htmlFor="generated-match-status">
                  <span>Match status</span>
                  <select id="generated-match-status" name="match_status" defaultValue="UNMATCHED">
                    {optionList(GENERATED_FILE_MATCH_STATUSES)}
                  </select>
                </label>
                <label className="stack auth-field" htmlFor="generated-imported-at">
                  <span>Imported at</span>
                  <input id="generated-imported-at" name="imported_at" type="text" placeholder="ISO timestamp" />
                </label>
              </div>
              <FormActions>
                <button className="button primary" type="submit">
                  Record file
                </button>
              </FormActions>
            </form>
          </details>

          {state.generatedFiles.length ? (
            <ul className="list">
              {state.generatedFiles.map((file) => {
                const clipJob = file.clip_job_id ? state.clipJobs.find((job) => job.id === file.clip_job_id) ?? null : null;
                const driveItem = resolveDriveItem(file.drive_item_id, driveItemMap);

                return (
                  <li key={file.id}>
                    <div className="stack-tight">
                      <strong>{file.file_name}</strong>
                      <span className="subtle">
                        {[driveItemLabel(driveItem), clipJob ? clipJob.job_code : null, file.detected_prefix].filter(Boolean).join(" - ")}
                      </span>
                      <div className="section-card__actions">
                        <StatusBadge status={file.match_status} />
                        {file.imported_at ? <StatusBadge status={`Imported ${formatDate(file.imported_at)}`} tone="success" /> : null}
                        {driveItem ? (
                          <Link className="button compact" href={driveItem.drive_url} target="_blank" rel="noreferrer">
                            <Archive size={15} aria-hidden="true" />
                            Open Drive item
                          </Link>
                        ) : null}
                      </div>
                    </div>

                    <details className="stack">
                      <summary>Edit file match</summary>
                      <form className="stack" action={saveController}>
                        <input type="hidden" name="intent" value="update_generated_file" />
                        <input type="hidden" name="id" value={file.id} />
                        <div className="grid two-up">
                          <label className="stack auth-field" htmlFor={`file-match-${file.id}`}>
                            <span>Match status</span>
                            <select id={`file-match-${file.id}`} name="match_status" defaultValue={file.match_status}>
                              {optionList(GENERATED_FILE_MATCH_STATUSES)}
                            </select>
                          </label>
                          <label className="stack auth-field" htmlFor={`file-imported-${file.id}`}>
                            <span>Imported at</span>
                            <input id={`file-imported-${file.id}`} name="imported_at" type="text" defaultValue={file.imported_at ?? ""} placeholder="ISO timestamp" />
                          </label>
                        </div>
                        <div className="grid two-up">
                          <label className="stack auth-field" htmlFor={`file-clip-job-${file.id}`}>
                            <span>Clip job id</span>
                            <input id={`file-clip-job-${file.id}`} name="clip_job_id" type="text" defaultValue={file.clip_job_id ?? ""} />
                          </label>
                          <label className="stack auth-field" htmlFor={`file-drive-item-${file.id}`}>
                            <span>Drive item id</span>
                            <input id={`file-drive-item-${file.id}`} name="drive_item_id" type="text" defaultValue={file.drive_item_id} />
                          </label>
                        </div>
                        <label className="stack auth-field" htmlFor={`file-name-${file.id}`}>
                          <span>File name</span>
                          <input id={`file-name-${file.id}`} name="file_name" type="text" defaultValue={file.file_name} />
                        </label>
                        <label className="stack auth-field" htmlFor={`file-prefix-${file.id}`}>
                          <span>Detected prefix</span>
                          <input id={`file-prefix-${file.id}`} name="detected_prefix" type="text" defaultValue={file.detected_prefix ?? ""} />
                        </label>
                        <FormActions>
                          <button className="button primary" type="submit">
                            Save file
                          </button>
                        </FormActions>
                      </form>
                      <div className="section-card__actions">
                        <IntentButton intent="mark_generated_file_imported" id={file.id} label="Mark imported" />
                      </div>
                    </details>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState icon={Archive} title="No generated files yet." description="Imported outputs and matching rows will appear here." />
          )}
        </SectionCard>
      </section>
    </div>
  );
}
