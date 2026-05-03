import { FileText, HardDrive, Package, Plus, Workflow, type LucideIcon } from "lucide-react";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { saveController } from "./actions";
import { EmptyState } from "@/components/operator/empty-state";
import { FormActions } from "@/components/operator/form-actions";
import { SectionCard } from "@/components/operator/section-card";
import { StatusBadge } from "@/components/operator/status-badge";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  buildFlowAssignmentPlan,
  buildPromptContextSummary,
  getControllerDashboardState,
  type ControllerAssignmentPlanItem,
  type ControllerPromptPackRecord,
  type ControllerProductRecord,
} from "@/lib/server/controller";
import { FLOW_ACCOUNT_TYPES, type FlowAccountPoolRecord } from "@/lib/server/flow-accounts";
import { type FlowBatchRecord, type FlowBatchStatus } from "@/lib/server/flow-batches";
import { type ClipJobRecord, type GeneratedFileRecord } from "@/lib/server/clip-jobs";

export const dynamic = "force-dynamic";

const BOARD_COLUMNS = [
  {
    key: "prompt_ready",
    title: "Prompt Siap",
    description: "",
    emptyTitle: "Prompt siap kosong.",
    emptyDescription: "Belum ada prompt.",
    icon: FileText,
    statuses: ["READY_TO_EXPORT", "EXPORTED"] as const,
  },
  {
    key: "running",
    title: "Sedang Flow",
    description: "",
    emptyTitle: "Belum ada batch berjalan.",
    emptyDescription: "Belum ada batch.",
    icon: Workflow,
    statuses: ["RUNNING"] as const,
  },
  {
    key: "output",
    title: "Output Masuk",
    description: "",
    emptyTitle: "Belum ada output masuk.",
    emptyDescription: "Belum ada output.",
    icon: HardDrive,
    statuses: ["IMPORTING", "PARTIALLY_IMPORTED", "IMPORTED", "NEED_MANUAL_MATCH"] as const,
  },
  {
    key: "done",
    title: "Selesai",
    description: "",
    emptyTitle: "Belum ada batch selesai.",
    emptyDescription: "Belum ada batch.",
    icon: Package,
    statuses: ["CLOSED"] as const,
  },
] as const;

type BoardColumnKey = (typeof BOARD_COLUMNS)[number]["key"];

type BatchAction = {
  intent: string;
  label: string;
  status?: FlowBatchStatus;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readPromptText(value: unknown) {
  if (!isRecord(value)) {
    return "";
  }

  const prompt = value.prompt ?? value.first_frame ?? value.last_frame;
  return typeof prompt === "string" ? prompt.trim() : "";
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "Belum ada.";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function truncate(value: string, max = 120) {
  return value.length > max ? `${value.slice(0, max - 3)}...` : value;
}

function todayInJakarta() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
}

function promptPackSnippet(promptPack: ControllerPromptPackRecord) {
  const candidates = [
    readPromptText(promptPack.i2v_prompts_json?.clip_1),
    readPromptText(promptPack.i2v_prompts_json?.clip_2),
    readPromptText(promptPack.i2i_prompts_json?.clip_1),
    readPromptText(promptPack.i2i_prompts_json?.clip_2),
    readPromptText(promptPack.i2v_prompts_json?.clip_01),
    readPromptText(promptPack.i2v_prompts_json?.clip_02),
    readPromptText(promptPack.i2i_prompts_json?.clip_01_start_frame),
    readPromptText(promptPack.i2i_prompts_json?.clip_01_last_frame),
  ];

  return candidates.find((candidate): candidate is string => typeof candidate === "string" && candidate.trim().length > 0)?.trim() ?? `Paket prompt ${promptPack.prompt_code}.`;
}

function productLabel(product: ControllerProductRecord | undefined | null) {
  if (!product) {
    return "Produk tidak tersedia";
  }

  return [product.product_code, product.product_name].filter(Boolean).join(" - ");
}

function accountLabel(account: FlowAccountPoolRecord | undefined | null) {
  if (!account) {
    return "Akun tidak tersedia";
  }

  return [account.account_code, account.account_type].filter(Boolean).join(" - ");
}

function accountTypeLabel(value: string) {
  return value.replace("FLOW_", "Flow ");
}

function flowAccountPoolStats(accounts: FlowAccountPoolRecord[]) {
  return {
    activeCount: accounts.filter((account) => account.status === "ACTIVE").length,
    availableCount: accounts.filter((account) => account.is_available).length,
    creditsRemaining: accounts.reduce((sum, account) => sum + account.credits_remaining, 0),
    slotsRemaining: accounts.reduce((sum, account) => sum + account.slots_remaining, 0),
    totalCount: accounts.length,
  };
}

function promptContextLine(promptPack: ControllerPromptPackRecord) {
  return buildPromptContextSummary(promptPack)
    .replace("No persisted prompt context.", "Belum ada konteks prompt tersimpan.")
    .replace("Â·", "-")
    .replace(" · ", " - ");
}

function latestTimestamp(values: Array<string | null | undefined>) {
  let latest: string | null = null;
  let latestMillis = -Infinity;

  for (const value of values) {
    if (!value) {
      continue;
    }

    const millis = Date.parse(value);
    if (Number.isNaN(millis) || millis <= latestMillis) {
      continue;
    }

    latest = value;
    latestMillis = millis;
  }

  return latest;
}

function batchColumnKey(status: FlowBatchStatus): BoardColumnKey {
  if (status === "RUNNING") {
    return "running";
  }

  if (status === "CLOSED") {
    return "done";
  }

  if (status === "IMPORTING" || status === "PARTIALLY_IMPORTED" || status === "IMPORTED" || status === "NEED_MANUAL_MATCH") {
    return "output";
  }

  return "prompt_ready";
}

function batchActionList(status: FlowBatchStatus): BatchAction[] {
  switch (status) {
    case "READY_TO_EXPORT":
      return [{ intent: "update_flow_batch", label: "Tandai Ekspor", status: "EXPORTED" as const }];
    case "EXPORTED":
      return [{ intent: "update_flow_batch", label: "Mulai Flow", status: "RUNNING" as const }];
    case "RUNNING":
      return [{ intent: "update_flow_batch", label: "Output Masuk", status: "IMPORTING" as const }];
    case "IMPORTING":
    case "PARTIALLY_IMPORTED":
    case "NEED_MANUAL_MATCH":
      return [{ intent: "update_flow_batch", label: "Tandai Masuk", status: "IMPORTED" as const }];
    case "IMPORTED":
      return [{ intent: "archive_flow_batch", label: "Tutup" }];
    default:
      return [];
  }
}

function batchStats(batch: FlowBatchRecord, clipJobs: ClipJobRecord[], generatedFiles: GeneratedFileRecord[]) {
  const clipCount = clipJobs.length;
  const outputCount = generatedFiles.length;
  const lastActionAt = latestTimestamp([batch.updated_at, ...clipJobs.map((job) => job.updated_at), ...generatedFiles.map((file) => file.updated_at)]);

  return {
    clipCount,
    outputCount,
    lastActionAt,
  };
}

function BatchActionButton({
  batchId,
  intent,
  label,
  status,
}: {
  batchId: string;
  intent: string;
  label: string;
  status?: FlowBatchStatus;
}) {
  return (
    <form action={saveController}>
      <input type="hidden" name="intent" value={intent} />
      <input type="hidden" name="id" value={batchId} />
      {status ? <input type="hidden" name="status" value={status} /> : null}
      <button className="button compact" type="submit">
        {label}
      </button>
    </form>
  );
}

function PreserveFlowAccountFields({ account, status }: { account: FlowAccountPoolRecord; status: string }) {
  return (
    <>
      <input type="hidden" name="id" value={account.id} />
      <input type="hidden" name="account_code" value={account.account_code} />
      <input type="hidden" name="account_type" value={account.account_type} />
      <input type="hidden" name="observed_daily_credit" value={account.observed_daily_credit} />
      <input type="hidden" name="observed_monthly_credit" value={account.observed_monthly_credit ?? ""} />
      <input type="hidden" name="credit_per_generation" value={account.credit_per_generation} />
      <input type="hidden" name="max_parallel_allowed" value={account.max_parallel_allowed} />
      <input type="hidden" name="cooldown_minutes" value={account.cooldown_minutes} />
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="notes" value={account.notes ?? ""} />
    </>
  );
}

function FlowAccountActions({ account }: { account: FlowAccountPoolRecord }) {
  return (
    <div className="section-card__actions">
      {account.status === "DISABLED" ? (
        <form action={saveController}>
          <input type="hidden" name="intent" value="update_flow_account" />
          <PreserveFlowAccountFields account={account} status="ACTIVE" />
          <button className="button compact" type="submit">
            Aktifkan
          </button>
        </form>
      ) : (
        <form action={saveController}>
          <input type="hidden" name="intent" value="archive_flow_account" />
          <input type="hidden" name="id" value={account.id} />
          <button className="button compact" type="submit">
            Arsipkan
          </button>
        </form>
      )}
    </div>
  );
}

function FlowAccountPanel({ accounts }: { accounts: FlowAccountPoolRecord[] }) {
  const stats = flowAccountPoolStats(accounts);

  return (
    <details className="controller-support-panel">
      <summary>
        <span>Akun Flow</span>
        <span className="section-card__actions controller-support-panel__summary">
          <StatusBadge status={`${stats.availableCount}/${stats.totalCount} tersedia`} tone={stats.availableCount > 0 ? "success" : "warning"} />
          <StatusBadge status={`${stats.activeCount} aktif`} tone="info" />
          <StatusBadge status={`${stats.creditsRemaining} kredit`} tone="info" />
          <StatusBadge status={`${stats.slotsRemaining} slot`} tone="info" />
        </span>
      </summary>

      <div className="controller-support-panel__body stack">
        <form className="stack" action={saveController}>
          <input type="hidden" name="intent" value="create_flow_account" />
          <input type="hidden" name="status" value="ACTIVE" />
          <div className="grid two-up">
            <label className="stack auth-field" htmlFor="flow-account-code">
              <span>Kode Akun</span>
              <input id="flow-account-code" name="account_code" type="text" placeholder="FLOW-FREE-01" required />
            </label>
            <label className="stack auth-field" htmlFor="flow-account-type">
              <span>Tipe Akun</span>
              <select id="flow-account-type" name="account_type" defaultValue="FLOW_FREE" required>
                {FLOW_ACCOUNT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {accountTypeLabel(type)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <FormActions>
            <button className="button compact primary" type="submit">
              <Plus size={16} aria-hidden="true" />
              Tambah akun
            </button>
          </FormActions>
        </form>

        {accounts.length ? (
          <ul className="list controller-account-list">
            {accounts.map((account) => (
              <li key={account.id}>
                <div className="stack-tight">
                  <strong>{account.account_code}</strong>
                  <span className="subtle">
                    {[
                      accountTypeLabel(account.account_type),
                      `${account.credits_remaining}/${account.observed_daily_credit} kredit`,
                      `${account.slots_remaining}/${account.max_parallel_allowed} slot`,
                      account.cooldown_remaining_minutes ? `${account.cooldown_remaining_minutes} menit cooldown` : "tanpa cooldown",
                    ]
                      .filter(Boolean)
                      .join(" - ")}
                  </span>
                  <div className="section-card__actions">
                    <StatusBadge status={account.status} />
                    <StatusBadge status={account.is_available ? "Ready" : "Tertahan"} tone={account.is_available ? "success" : "warning"} />
                    <StatusBadge status={`Saran ${account.recommended_max_jobs} job`} tone="info" />
                  </div>
                  {account.eligibility_reasons.length ? <span className="subtle">{account.eligibility_reasons.join(" - ")}</span> : null}
                </div>
                <FlowAccountActions account={account} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={Workflow} title="Belum ada akun Flow." description="Buat akun pertama." />
        )}
      </div>
    </details>
  );
}

function FlowAccountPicker({
  accounts,
  recommendedAccountId,
  name,
}: {
  accounts: FlowAccountPoolRecord[];
  recommendedAccountId: string | null | undefined;
  name: string;
}) {
  const orderedAccounts = [...accounts].sort((left, right) => {
    if (left.id === recommendedAccountId && right.id !== recommendedAccountId) {
      return -1;
    }

    if (right.id === recommendedAccountId && left.id !== recommendedAccountId) {
      return 1;
    }

    return left.account_code.localeCompare(right.account_code);
  });

  return (
    <div className="controller-account-picker" role="radiogroup" aria-label="Pilih akun Flow">
      {orderedAccounts.map((account) => {
        const isRecommended = account.id === recommendedAccountId;

        return (
          <label className="controller-account-option" htmlFor={`${name}-${account.id}`} key={account.id}>
            <div className="controller-account-option__check">
              <input
                defaultChecked={isRecommended}
                id={`${name}-${account.id}`}
                name={name}
                type="radio"
                value={account.id}
                required
              />
              <span className="controller-account-option__body">
                <span className="controller-account-option__title">
                  <strong>{account.account_code}</strong>
                  {isRecommended ? <StatusBadge status="Disarankan" tone="success" /> : null}
                </span>
                <span className="controller-account-option__meta">
                  {[
                    account.account_type,
                    `${account.credits_remaining} kredit`,
                    `${account.slots_remaining} slot`,
                    account.cooldown_minutes ? `${account.cooldown_minutes} menit cooldown` : "tanpa cooldown",
                  ]
                    .filter(Boolean)
                    .join(" - ")}
                </span>
              </span>
            </div>
          </label>
        );
      })}
    </div>
  );
}

function PromptQueueCard({
  promptPack,
  product,
  plan,
  eligibleAccounts,
  currentWorkspaceId,
}: {
  promptPack: ControllerPromptPackRecord;
  product: ControllerProductRecord | undefined;
  plan: ControllerAssignmentPlanItem | null;
  eligibleAccounts: FlowAccountPoolRecord[];
  currentWorkspaceId: string | null;
}) {
  const queueable = Boolean(plan && plan.status === "READY" && product && eligibleAccounts.length && plan.recommendedAccountId);
  const promptSnippet = truncate(promptPackSnippet(promptPack), 160);
  const promptContext = promptContextLine(promptPack);
  const unavailableMessage = !product ? "Produk tidak tersedia." : plan?.reason ?? "Tidak ada akun Flow yang layak.";

  return (
    <li>
      <div className="stack-tight">
        <strong>{promptPack.prompt_code}</strong>
        <span className="subtle">{[productLabel(product), `v${promptPack.version}`, promptContext].filter(Boolean).join(" - ")}</span>
        <p className="subtle">{promptSnippet}</p>
        <div className="section-card__actions">
          <StatusBadge status={promptPack.status} />
          <StatusBadge status="Klip 0" tone="info" />
          {plan?.status === "READY" ? (
            <>
              <StatusBadge status={`Disarankan ${plan.recommendedAccountCode ?? "akun Flow"}`} tone="success" />
              <StatusBadge status={`Saran ${plan.recommendedMaxJobs} job`} tone="info" />
            </>
          ) : (
            <StatusBadge status={plan?.reason ?? "Tidak ada rekomendasi."} tone="warning" />
          )}
        </div>
        <span className="subtle">Aksi terakhir {formatDate(promptPack.updated_at)}</span>
      </div>

      {queueable && product ? (
        <form className="stack" action={saveController}>
          <input type="hidden" name="intent" value="create_flow_batch" />
          <input type="hidden" name="workspace_id" value={product.workspace_id ?? currentWorkspaceId ?? ""} />
          <input type="hidden" name="product_id" value={promptPack.product_id} />
          <input type="hidden" name="prompt_pack_id" value={promptPack.id} />
          <input type="hidden" name="target_date" value={todayInJakarta()} />
          <input type="hidden" name="status" value="READY_TO_EXPORT" />
          <input type="hidden" name="model" value="google-flow" />
          <label className="stack auth-field">
            <span>Akun Flow</span>
            <FlowAccountPicker accounts={eligibleAccounts} recommendedAccountId={plan?.recommendedAccountId} name="flow_account_id" />
          </label>
          <label className="checkbox-row">
            <input name="confirm_flow_account" type="checkbox" required />
            <span>Konfirmasi akun Flow pilihan.</span>
          </label>
          <FormActions>
            <button className="button compact primary" type="submit">
              Konfirmasi batch
            </button>
          </FormActions>
        </form>
      ) : (
        <div className="error-box" role="status">
          {unavailableMessage}
        </div>
      )}
    </li>
  );
}

function BatchCard({
  batch,
  product,
  promptPack,
  account,
  clipJobs,
  generatedFiles,
}: {
  batch: FlowBatchRecord;
  product: ControllerProductRecord | undefined;
  promptPack: ControllerPromptPackRecord | undefined;
  account: FlowAccountPoolRecord | undefined;
  clipJobs: ClipJobRecord[];
  generatedFiles: GeneratedFileRecord[];
}) {
  const stats = batchStats(batch, clipJobs, generatedFiles);
  const actions = batchActionList(batch.status);

  return (
    <li>
      <div className="stack-tight">
        <strong>{batch.batch_code}</strong>
        <span className="subtle">{[productLabel(product), promptPack?.prompt_code, accountLabel(account)].filter(Boolean).join(" - ")}</span>
        <p className="subtle">
          Klip {stats.clipCount} - Output {stats.outputCount}
        </p>
        <div className="section-card__actions">
          <StatusBadge status={batch.status} />
          <StatusBadge status={`Aksi ${formatDate(stats.lastActionAt)}`} tone="neutral" />
        </div>
      </div>

      <div className="section-card__actions">
        {actions.length ? actions.map((action) => <BatchActionButton batchId={batch.id} intent={action.intent} label={action.label} status={action.status} key={`${batch.id}-${action.label}`} />) : null}
      </div>
    </li>
  );
}

function ControllerColumn({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <SectionCard icon={Icon} title={title} description={description}>
      {children}
    </SectionCard>
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
    const message = error instanceof Error ? error.message : "Gagal memuat controller.";

    return (
      <SectionCard icon={Workflow} title="Controller tidak tersedia." description={message}>
        <EmptyState icon={Workflow} title="Controller tidak tersedia." description="Coba lagi." />
      </SectionCard>
    );
  }

  const productMap = new Map(state.products.map((product) => [product.id, product]));
  const promptPackMap = new Map(state.promptPacks.map((pack) => [pack.id, pack]));
  const accountMap = new Map(state.flowAccounts.map((account) => [account.id, account]));
  const clipJobMap = new Map(state.clipJobs.map((job) => [job.id, job]));

  const clipJobsByBatchId = new Map<string, ClipJobRecord[]>();
  for (const job of state.clipJobs) {
    if (!job.batch_id) {
      continue;
    }

    const current = clipJobsByBatchId.get(job.batch_id) ?? [];
    current.push(job);
    clipJobsByBatchId.set(job.batch_id, current);
  }

  const generatedFilesByBatchId = new Map<string, GeneratedFileRecord[]>();
  for (const file of state.generatedFiles) {
    if (!file.clip_job_id) {
      continue;
    }

    const clipJob = clipJobMap.get(file.clip_job_id);
    if (!clipJob?.batch_id) {
      continue;
    }

    const current = generatedFilesByBatchId.get(clipJob.batch_id) ?? [];
    current.push(file);
    generatedFilesByBatchId.set(clipJob.batch_id, current);
  }

  const existingPromptPackIds = new Set(
    state.flowBatches.filter((batch) => batch.prompt_pack_id && batch.status !== "CLOSED").map((batch) => batch.prompt_pack_id as string),
  );
  const assignmentPlan = buildFlowAssignmentPlan({
    promptPacks: state.promptPacks,
    accounts: state.flowAccounts,
    existingPromptPackIds,
  });
  const planMap = new Map(assignmentPlan.map((item) => [item.promptPackId, item]));
  const readyQueuePromptPacks = state.readyPromptPacks.filter((promptPack) => !existingPromptPackIds.has(promptPack.id));
  const eligibleAccounts = state.flowAccounts.filter((account) => account.is_available);

  const batchesByColumn = new Map<BoardColumnKey, FlowBatchRecord[]>(BOARD_COLUMNS.map((column) => [column.key, [] as FlowBatchRecord[]]));
  for (const batch of state.flowBatches) {
    const columnKey = batchColumnKey(batch.status as FlowBatchStatus);
    const current = batchesByColumn.get(columnKey) ?? [];
    current.push(batch);
    batchesByColumn.set(columnKey, current);
  }

  return (
    <div className="stack">
      <FlowAccountPanel accounts={state.flowAccounts} />

      <section className="controller-board">
        {BOARD_COLUMNS.map((column) => {
          const batches = batchesByColumn.get(column.key) ?? [];

          return (
            <ControllerColumn icon={column.icon} key={column.key} title={column.title} description={column.description}>
              {column.key === "prompt_ready" && readyQueuePromptPacks.length ? (
                <div className="stack">
                  <p className="subtle">Antrian baru</p>
                  <ul className="list">
                    {readyQueuePromptPacks.map((promptPack) => {
                      const plan = planMap.get(promptPack.id) ?? null;
                      const product = productMap.get(promptPack.product_id);

                      return (
                        <PromptQueueCard
                          currentWorkspaceId={state.currentWorkspace?.id ?? null}
                          eligibleAccounts={eligibleAccounts}
                          key={promptPack.id}
                          plan={plan}
                          product={product}
                          promptPack={promptPack}
                        />
                      );
                    })}
                  </ul>
                </div>
              ) : null}

              {batches.length ? (
                <ul className="list">
                  {batches.map((batch) => {
                    const account = accountMap.get(batch.flow_account_id);
                    const product = batch.product_id ? productMap.get(batch.product_id) : undefined;
                    const promptPack = batch.prompt_pack_id ? promptPackMap.get(batch.prompt_pack_id) : undefined;

                    return (
                      <BatchCard
                        account={account}
                        batch={batch}
                        clipJobs={clipJobsByBatchId.get(batch.id) ?? []}
                        generatedFiles={generatedFilesByBatchId.get(batch.id) ?? []}
                        key={batch.id}
                        product={product}
                        promptPack={promptPack}
                      />
                    );
                  })}
                </ul>
              ) : null}

              {column.key === "prompt_ready" && !readyQueuePromptPacks.length && !batches.length ? (
                <EmptyState icon={FileText} title={column.emptyTitle} description={column.emptyDescription} />
              ) : null}

              {column.key !== "prompt_ready" && !batches.length ? (
                <EmptyState icon={column.icon} title={column.emptyTitle} description={column.emptyDescription} />
              ) : null}
            </ControllerColumn>
          );
        })}
      </section>
    </div>
  );
}
