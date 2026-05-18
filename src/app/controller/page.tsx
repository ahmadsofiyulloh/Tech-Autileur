import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Download, ExternalLink, FileJson, ListPlus, MonitorPlay, Plus, Save, Workflow, X, Zap } from "lucide-react";
import { EmptyState } from "@/components/operator/empty-state";
import { PendingActionButton } from "@/components/operator/pending-action-button";
import { SectionCard } from "@/components/operator/section-card";
import { StatusBadge } from "@/components/operator/status-badge";
import { NativeAnchorButton, NativeLinkButton } from "@/components/ui/native-button";
import {
  buildFlowAssignmentPlan,
  CONTROLLER_BATCH_SELECTION_DEFAULT_CAP,
  getControllerDashboardState,
  type ControllerAssignmentPlanItem,
} from "@/lib/server/controller";
import type { FlowBatchRecord, FlowBatchStatus } from "@/lib/server/flow-batches";
import { readChromeProfileLaneKey } from "@/lib/server/flow-accounts";
import type { FlowAccountPoolRecord } from "@/lib/server/flow-accounts";
import type { ClipJobRecord, GeneratedFileRecord } from "@/lib/server/clip-jobs";
import { saveController } from "./actions";
import { ControllerManifestPopover } from "./controller-manifest-popover";
import { ControllerMobileRedirect } from "./controller-mobile-redirect";
import { ControllerWorkflowStepper, type ControllerWorkflowStepperStep } from "./controller-workflow-stepper";
import { formatAppDateKey, formatAppDateTime } from "@/lib/app-time";

export const dynamic = "force-dynamic";

const PROMPT_READY_BATCH_STATUSES = new Set<FlowBatchStatus>(["READY_TO_EXPORT", "EXPORTED"]);
const FLOW_RUNNING_BATCH_STATUSES = new Set<FlowBatchStatus>(["RUNNING"]);
const OUTPUT_BATCH_STATUSES = new Set<FlowBatchStatus>(["IMPORTING", "PARTIALLY_IMPORTED", "IMPORTED", "NEED_MANUAL_MATCH"]);
const IMPORTED_MATCH_STATUSES = new Set(["MATCHED", "IMPORTED"]);
const REVIEW_MATCH_STATUSES = new Set(["NEEDS_REVIEW", "UNMATCHED"]);
const ERROR_MATCH_STATUSES = new Set(["ERROR"]);
const FLOW_STAGE_NAMES = ["FIRST_FRAME", "LAST_FRAME", "VIDEO"] as const;

type FlowStageName = (typeof FLOW_STAGE_NAMES)[number];
type StatusTone = "neutral" | "info" | "success" | "warning" | "danger";
type ControllerWorkflowStepId =
  | "prompt-ready"
  | "batch-setup"
  | "manifest-export"
  | "helper-prep"
  | "manual-flow-run"
  | "output-import"
  | "reconcile-close";

type ControllerWorkflowStep = ControllerWorkflowStepperStep & {
  id: ControllerWorkflowStepId;
};

function isMobileUserAgent(userAgent: string) {
  return /mobi|android|iphone|ipad|ipod/i.test(userAgent);
}

function isControllerPlaceholderEnabled() {
  return true;
}

function formatActionTime(value: string | null | undefined) {
  return formatAppDateTime(value, "Belum ada aksi");
}

function todayInJakarta() {
  return formatAppDateKey();
}

function productName(productId: string | null | undefined, productMap: Map<string, { product_name: string }>) {
  return productId ? productMap.get(productId)?.product_name ?? "Produk" : "Produk";
}

function accountLabel(accountId: string, accountMap: Map<string, FlowAccountPoolRecord>) {
  const account = accountMap.get(accountId);

  if (!account) {
    return "Akun Flow";
  }

  return `${account.account_type} / ${account.status}`;
}

function accountLaneKey(accountId: string, accountMap: Map<string, FlowAccountPoolRecord>) {
  const account = accountMap.get(accountId);

  if (!account) {
    return null;
  }

  return readChromeProfileLaneKey(account.notes);
}

function groupClipJobsByBatch(clipJobs: ClipJobRecord[]) {
  const result = new Map<string, ClipJobRecord[]>();

  for (const clipJob of clipJobs) {
    if (!clipJob.batch_id) {
      continue;
    }

    result.set(clipJob.batch_id, [...(result.get(clipJob.batch_id) ?? []), clipJob]);
  }

  return result;
}

function groupGeneratedFilesByClipJob(generatedFiles: GeneratedFileRecord[]) {
  const result = new Map<string, GeneratedFileRecord[]>();

  for (const file of generatedFiles) {
    if (!file.clip_job_id) {
      continue;
    }

    result.set(file.clip_job_id, [...(result.get(file.clip_job_id) ?? []), file]);
  }

  return result;
}

function summarizeStageImports(
  clipJobs: ClipJobRecord[],
  generatedFileMap: Map<string, GeneratedFileRecord[]>,
  stage: FlowStageName,
  total: number,
) {
  const summary = clipJobs.reduce(
    (result, clipJob) => {
      const files = (generatedFileMap.get(clipJob.id) ?? []).filter((file) => file.stage === stage);

      if (files.some((file) => ERROR_MATCH_STATUSES.has(file.match_status))) {
        return { ...result, error: result.error + 1 };
      }

      if (files.some((file) => REVIEW_MATCH_STATUSES.has(file.match_status))) {
        return { ...result, review: result.review + 1 };
      }

      if (files.some((file) => IMPORTED_MATCH_STATUSES.has(file.match_status))) {
        return { ...result, imported: result.imported + 1 };
      }

      return result;
    },
    { imported: 0, review: 0, error: 0 },
  );

  return {
    ...summary,
    total,
    waiting: Math.max(total - summary.imported - summary.review - summary.error, 0),
  };
}

function stageStatusLabel(summary: ReturnType<typeof summarizeStageImports>) {
  if (summary.error) {
    return `${summary.error} Error`;
  }

  if (summary.review) {
    return `${summary.review} Review`;
  }

  if (summary.imported === summary.total && summary.total > 0) {
    return "Imported";
  }

  if (summary.imported) {
    return `${summary.imported}/${summary.total} Imported`;
  }

  return "Belum ada";
}

function stageStatusTone(summary: ReturnType<typeof summarizeStageImports>): StatusTone {
  if (summary.error) {
    return "danger" as const;
  }

  if (summary.review) {
    return "warning" as const;
  }

  if (summary.imported === summary.total && summary.total > 0) {
    return "success" as const;
  }

  if (summary.imported) {
    return "info" as const;
  }

  return "neutral" as const;
}

function StageImportRows({
  clipJobs,
  generatedFileMap,
  clipCount,
}: {
  clipJobs: ClipJobRecord[];
  generatedFileMap: Map<string, GeneratedFileRecord[]>;
  clipCount: number;
}) {
  return (
    <div className="controller-stage-list" aria-label="Stage import state">
      {FLOW_STAGE_NAMES.map((stage) => {
        const summary = summarizeStageImports(clipJobs, generatedFileMap, stage, clipCount);

        return (
          <div className="controller-stage-row" key={stage}>
            <div className="stack-tight">
              <strong>{stage}</strong>
              <span>{`${summary.imported}/${summary.total} imported`}</span>
            </div>
            <div className="controller-inline-badges">
              <StatusBadge status={stageStatusLabel(summary)} tone={stageStatusTone(summary)} />
              {summary.review ? (
                <StatusBadge status={`${summary.review} review`} tone="warning" size="sm" variant="pill" />
              ) : null}
              {summary.waiting ? (
                <StatusBadge status={`${summary.waiting} belum`} tone="neutral" size="sm" variant="pill" muted />
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function HiddenInput({ name, value }: { name: string; value: string | number | null | undefined }) {
  return <input type="hidden" name={name} value={value ?? ""} />;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stepCountLabel(count: number) {
  return count > 0 ? `${count} item` : "Kosong";
}

function accountAvailabilityLabel(account: FlowAccountPoolRecord) {
  return account.is_available ? "Perkiraan tersedia" : "Perkiraan tidak tersedia";
}

function readManifestChromeProfileLaneKey(manifestJson: unknown) {
  if (!isRecord(manifestJson)) {
    return null;
  }

  return readChromeProfileLaneKey(typeof manifestJson.chrome_profile_lane_key === "string" ? manifestJson.chrome_profile_lane_key : null);
}

function FlowAccountSupportPanel({ accounts }: { accounts: FlowAccountPoolRecord[] }) {
  const availableCount = accounts.filter((account) => account.is_available).length;
  const laneKeyCount = accounts.filter((account) => readChromeProfileLaneKey(account.notes)).length;

  return (
    <section className="controller-support-panel panel" aria-label="Pengaturan Akun Flow">
      <div className="controller-support-panel__header">
        <strong>Pengaturan Akun Flow</strong>
        <div className="controller-support-panel__summary">
          <StatusBadge
            status={`${accounts.length} akun`}
            tone="neutral"
            size="sm"
            variant="pill"
            muted
          />
          <StatusBadge
            status={availableCount ? `${availableCount} perkiraan siap` : "Belum ada perkiraan siap"}
            tone={availableCount ? "success" : "warning"}
            size="sm"
            variant="pill"
          />
          <StatusBadge
            status={laneKeyCount ? `${laneKeyCount} lane key set` : "Lane key belum ada"}
            tone={laneKeyCount ? "success" : "warning"}
            size="sm"
            variant="pill"
          />
          <StatusBadge
            status="Verifikasi helper belum tersedia"
            tone="warning"
            size="sm"
            variant="pill"
          />
        </div>
      </div>
      <div className="controller-support-panel__body stack">
        {accounts.length ? (
          <ul className="list controller-account-list">
            {accounts.map((account) => {
              const laneKey = readChromeProfileLaneKey(account.notes);

              return (
                <li key={account.id}>
                  <div className="controller-account-row">
                    <div className="controller-account-row__primary stack-tight">
                      <strong>{account.account_type}</strong>
                      <span>{account.account_code}</span>
                      <span>{laneKey ? `Lane ${laneKey}` : "Lane belum di-set"}</span>
                      <span>{`${account.credits_remaining} kredit / ${account.slots_remaining} slot`}</span>
                    </div>
                    <div className="controller-inline-badges">
                      <StatusBadge status={account.status} />
                      <StatusBadge
                        status={accountAvailabilityLabel(account)}
                        tone={account.is_available ? "success" : "warning"}
                        size="sm"
                        variant="pill"
                      />
                      <StatusBadge
                        status={laneKey ? "Lane key set" : "Not paired"}
                        tone={laneKey ? "success" : "warning"}
                        size="sm"
                        variant="pill"
                      />
                    </div>
                  </div>
                  <form action={saveController} className="controller-inline-form controller-account-lane-form">
                    <HiddenInput name="intent" value="update_flow_account" />
                    <HiddenInput name="id" value={account.id} />
                    <label className="auth-field">
                      <span>Lane key Chrome</span>
                      <input name="chrome_profile_lane_key" defaultValue={laneKey ?? ""} placeholder="utama" />
                    </label>
                    <PendingActionButton className="compact tertiary controller-account-lane-form__button" pendingLabel="Menyimpan">
                      <Save size={15} aria-hidden="true" />
                      Simpan lane
                    </PendingActionButton>
                  </form>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState title="Akun Flow belum ada." description="Tambah akun Flow." />
        )}
        <form action={saveController} className="controller-inline-form controller-add-account-form">
          <HiddenInput name="intent" value="create_flow_account" />
          <HiddenInput name="account_type" value="FLOW_FREE" />
          <HiddenInput name="observed_daily_credit" value="50" />
          <HiddenInput name="credit_per_generation" value="10" />
          <HiddenInput name="max_parallel_allowed" value="1" />
          <HiddenInput name="cooldown_minutes" value="0" />
          <HiddenInput name="status" value="ACTIVE" />
          <label className="auth-field">
            <span>Lane key Chrome</span>
            <input name="chrome_profile_lane_key" placeholder="utama" />
          </label>
          <PendingActionButton className="compact primary" pendingLabel="Menambah">
            <Plus size={15} aria-hidden="true" />
            Tambah akun
          </PendingActionButton>
        </form>
      </div>
    </section>
  );
}

function GeneratedPromptCard({
  promptPack,
  productName,
}: {
  promptPack: { id: string; prompt_code: string; version: number; status: string; updated_at: string };
  productName: string;
}) {
  return (
    <article className="controller-lane-card controller-prompt-card">
      <div className="controller-lane-card__header">
        <div className="stack-tight">
          <strong>{productName}</strong>
          <span>{`Paket ${promptPack.prompt_code} v${promptPack.version}`}</span>
        </div>
        <StatusBadge status={promptPack.status} />
      </div>
      <div className="controller-lane-card__meta">
        <span>{formatActionTime(promptPack.updated_at)}</span>
      </div>
      <form action={saveController} className="controller-inline-form">
        <HiddenInput name="intent" value="mark_prompt_ready" />
        <HiddenInput name="id" value={promptPack.id} />
        <PendingActionButton className="compact primary" pendingLabel="Menyiapkan">
          <Zap size={15} aria-hidden="true" />
          Siapkan Flow
        </PendingActionButton>
      </form>
    </article>
  );
}

function BatchSelectionCard({
  promptPack,
  productName,
  planItem,
  defaultChecked,
}: {
  promptPack: { id: string; product_id: string; prompt_code: string; version: number; status: string; updated_at: string };
  productName: string;
  planItem: ControllerAssignmentPlanItem;
  defaultChecked?: boolean;
}) {
  const isSelectable = planItem.status === "READY";

  return (
    <article className={`controller-lane-card controller-batch-selection-card${isSelectable ? "" : " controller-batch-selection-card--skipped"}`}>
      <div className="controller-lane-card__header">
        <div className="stack-tight">
          {isSelectable ? (
            <label className="checkbox-row controller-batch-selection-card__picker">
              <input
                defaultChecked={defaultChecked}
                id={`batch-select-${promptPack.id}`}
                name="prompt_pack_ids"
                type="checkbox"
                value={promptPack.id}
              />
              <span>Pilih batch ini</span>
            </label>
          ) : (
            <span className="controller-batch-selection-card__picker controller-batch-selection-card__picker--disabled">Dilewati</span>
          )}
          <strong>{productName}</strong>
          <span>{`Paket ${promptPack.prompt_code} v${promptPack.version}`}</span>
        </div>
        <StatusBadge status={isSelectable ? "Prompt Siap" : "Dilewati"} tone={isSelectable ? "success" : "warning"} />
      </div>
      <div className="controller-batch-selection-card__meta">
        <span>{isSelectable ? `${planItem.recommendedAccountCode} / ${planItem.reason}` : planItem.reason}</span>
        <span>{formatActionTime(promptPack.updated_at)}</span>
      </div>
    </article>
  );
}

function ExportManifestPanel({ batch, flowAccountLaneKey }: { batch: FlowBatchRecord; flowAccountLaneKey: string | null }) {
  const chromeProfileLaneKey = readManifestChromeProfileLaneKey(batch.manifest_json) ?? flowAccountLaneKey;

  return (
    <ControllerManifestPopover>
      <div className="controller-manifest-popover__status">
        <StatusBadge
          status={batch.manifest_json ? "Tersedia" : "Belum"}
          tone={batch.manifest_json ? "success" : "warning"}
          size="sm"
          variant="pill"
        />
        <StatusBadge
          status={chromeProfileLaneKey ? "Lane key set" : "Not paired"}
          tone={chromeProfileLaneKey ? "success" : "warning"}
          size="sm"
          variant="pill"
        />
      </div>
      <form action={saveController} className="controller-manifest-form stack">
        <HiddenInput name="intent" value="export_flow_manifest" />
        <HiddenInput name="id" value={batch.id} />
        <div className="controller-manifest-form__field-grid">
          <label className="auth-field">
            <span>Flow URL</span>
            <input name="flow_url" defaultValue={batch.flow_url ?? ""} placeholder="https://labs.google.com/fx/tools/flow" />
          </label>
          <label className="auth-field">
            <span>Lane Chrome</span>
            <input name="chrome_profile_lane_key" defaultValue={chromeProfileLaneKey ?? ""} placeholder="utama" />
          </label>
        </div>
        <div className="controller-manifest-form__divider" aria-hidden="true" />
        <div className="controller-manifest-form__field-grid">
          <label className="auth-field">
            <span>Folder Drive ID</span>
            <input name="drive_output_folder_id" defaultValue={batch.drive_output_folder_id ?? ""} />
          </label>
          <label className="auth-field">
            <span>Folder Drive URL</span>
            <input name="drive_output_folder_url" defaultValue={batch.drive_output_folder_url ?? ""} />
          </label>
        </div>
        <label className="auth-field">
          <span>Output Key</span>
          <input name="helper_output_folder_key" defaultValue={batch.helper_output_folder_key ?? ""} />
        </label>
        <div className="controller-action-row controller-manifest-form__footer">
          {batch.manifest_json ? (
            <NativeLinkButton className="compact tertiary" href={`/controller/batches/${batch.id}/manifest`}>
              <Download size={15} aria-hidden="true" />
              Unduh
            </NativeLinkButton>
          ) : null}
          <PendingActionButton className="compact tertiary" pendingLabel="Mengekspor">
            <FileJson size={15} aria-hidden="true" />
            Ekspor Manifest
          </PendingActionButton>
          {batch.flow_url ? (
            <NativeAnchorButton className="compact primary" href={batch.flow_url} rel="noreferrer" target="_blank">
              <ExternalLink size={15} aria-hidden="true" />
              Buka Flow
            </NativeAnchorButton>
          ) : null}
        </div>
      </form>
    </ControllerManifestPopover>
  );
}

function BatchCard({
  batch,
  productName,
  accountLabel,
  flowAccountLaneKey,
  clipJobs,
  generatedFileMap,
}: {
  batch: FlowBatchRecord;
  productName: string;
  accountLabel: string;
  flowAccountLaneKey: string | null;
  clipJobs: ClipJobRecord[];
  generatedFileMap: Map<string, GeneratedFileRecord[]>;
}) {
  const clipCount = clipJobs.length || Math.min(batch.max_jobs || 2, 2);
  const canStart = batch.status === "EXPORTED" || batch.status === "READY_TO_EXPORT";
  const canMarkImported = OUTPUT_BATCH_STATUSES.has(batch.status) || batch.status === "RUNNING";
  const canClose = batch.status !== "CLOSED";
  const chromeProfileLaneKey = readManifestChromeProfileLaneKey(batch.manifest_json) ?? flowAccountLaneKey;
  const laneStatusLabel = chromeProfileLaneKey ? "Lane key set" : "Not paired";

  return (
    <article className="controller-lane-card controller-batch-card">
      <div className="controller-batch-info-grid">
        <div className="stack-tight">
          <strong>{productName}</strong>
          <span>{batch.batch_code}</span>
        </div>
        <div className="controller-card-status-stack">
          <StatusBadge status={batch.status} />
          <StatusBadge
            status={laneStatusLabel}
            tone={chromeProfileLaneKey ? "success" : "warning"}
            size="sm"
            variant="pill"
          />
        </div>
      </div>
      <div className="controller-lane-card__meta controller-batch-card__meta">
        <span>{accountLabel}</span>
        <span>{`${clipCount} clip`}</span>
        {chromeProfileLaneKey ? <span>{`Lane ${chromeProfileLaneKey}`}</span> : <span>Lane belum di-set</span>}
        <span>{formatActionTime(batch.updated_at)}</span>
      </div>
      <div className="controller-card-section controller-card-section--stage">
        <StageImportRows clipJobs={clipJobs} generatedFileMap={generatedFileMap} clipCount={clipCount} />
      </div>
      <div className="controller-action-row controller-card-section controller-card-section--actions">
        {PROMPT_READY_BATCH_STATUSES.has(batch.status) ? <ExportManifestPanel batch={batch} flowAccountLaneKey={flowAccountLaneKey} /> : null}
        {canStart ? (
          <form action={saveController}>
            <HiddenInput name="intent" value="update_flow_batch" />
            <HiddenInput name="id" value={batch.id} />
            <HiddenInput name="status" value="RUNNING" />
            <PendingActionButton className="compact primary" pendingLabel="Memulai">
              <MonitorPlay size={15} aria-hidden="true" />
              Mulai Flow
            </PendingActionButton>
          </form>
        ) : null}
        {canMarkImported ? (
          <form action={saveController}>
            <HiddenInput name="intent" value="update_flow_batch" />
            <HiddenInput name="id" value={batch.id} />
            <HiddenInput name="status" value="IMPORTED" />
            <PendingActionButton className="compact tertiary" pendingLabel="Menandai">
              <Download size={15} aria-hidden="true" />
              Tandai Masuk
            </PendingActionButton>
          </form>
        ) : null}
        {canClose ? (
          <form action={saveController}>
            <HiddenInput name="intent" value="archive_flow_batch" />
            <HiddenInput name="id" value={batch.id} />
            <PendingActionButton className="compact tertiary" pendingLabel="Menutup">
              <X size={15} aria-hidden="true" />
              Tutup
            </PendingActionButton>
          </form>
        ) : null}
      </div>
    </article>
  );
}

function ControllerStepSection({
  title,
  status,
  children,
}: {
  title: string;
  status: string;
  children: ReactNode;
}) {
  return (
    <SectionCard
      className="controller-step-section"
      title={title}
      actions={
        <StatusBadge
          status={status}
          tone={status === "Kosong" ? "neutral" : "success"}
          size="sm"
          variant="pill"
          muted={status === "Kosong"}
        />
      }
    >
      {children}
    </SectionCard>
  );
}

export default async function ControllerPage() {
  const requestHeaders = await headers();

  if (isMobileUserAgent(requestHeaders.get("user-agent") ?? "")) {
    redirect("/products/new");
  }

  if (isControllerPlaceholderEnabled()) {
    return (
      <>
        <ControllerMobileRedirect />
        <div className="controller-placeholder stack">
          <SectionCard
            icon={Workflow}
            title="Flow Control"
            actions={<StatusBadge status="Coming soon" tone="warning" size="sm" variant="pill" />}
          >
            <EmptyState title="Coming soon." description="Flow Control sedang diparkir." icon={Workflow} />
          </SectionCard>
        </div>
      </>
    );
  }

  let state: Awaited<ReturnType<typeof getControllerDashboardState>>;

  try {
    state = await getControllerDashboardState();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Flow Control tidak tersedia.";

    return (
      <>
        <ControllerMobileRedirect />
        <SectionCard icon={Workflow} title="Flow Control tidak tersedia." description={message}>
          <EmptyState title="Flow Control tidak tersedia." description="Coba lagi." />
        </SectionCard>
      </>
    );
  }

  const productMap = new Map(state.products.map((product) => [product.id, product]));
  const accountMap = new Map(state.flowAccounts.map((account) => [account.id, account]));
  const promptPackMap = new Map(state.readyPromptPacks.map((promptPack) => [promptPack.id, promptPack]));
  const openPromptPackBatchIds = new Set(
    state.flowBatches
      .filter((batch) => batch.prompt_pack_id && batch.status !== "CLOSED")
      .map((batch) => batch.prompt_pack_id as string),
  );
  const generatedPromptPacks = state.promptPacks.filter(
    (promptPack) => promptPack.status === "GENERATED" && !openPromptPackBatchIds.has(promptPack.id),
  );
  const batchSelectionPlan = buildFlowAssignmentPlan({
    promptPacks: state.readyPromptPacks,
    accounts: state.flowAccounts,
    existingPromptPackIds: openPromptPackBatchIds,
  });
  const batchSelectionReadyCount = batchSelectionPlan.filter((item) => item.status === "READY").length;
  const batchSelectionSkippedCount = batchSelectionPlan.length - batchSelectionReadyCount;
  const availableFlowAccountCount = state.flowAccounts.filter((account) => account.is_available).length;
  const clipJobsByBatch = groupClipJobsByBatch(state.clipJobs);
  const generatedFilesByClipJob = groupGeneratedFilesByClipJob(state.generatedFiles);
  const readyToExportBatches = state.flowBatches.filter((batch) => batch.status === "READY_TO_EXPORT");
  const exportedBatches = state.flowBatches.filter((batch) => batch.status === "EXPORTED");
  const runningBatches = state.flowBatches.filter((batch) => FLOW_RUNNING_BATCH_STATUSES.has(batch.status));
  const importingBatches = state.flowBatches.filter((batch) => batch.status === "IMPORTING" || batch.status === "PARTIALLY_IMPORTED");
  const reconcileBatches = state.flowBatches.filter((batch) => batch.status === "IMPORTED" || batch.status === "NEED_MANUAL_MATCH" || batch.status === "CLOSED");

  const workflowSteps: ControllerWorkflowStep[] = [
    {
      id: "prompt-ready",
      number: 1,
      title: "Prompt Ready",
      count: generatedPromptPacks.length,
    },
    {
      id: "batch-setup",
      number: 2,
      title: "Batch Setup",
      count: batchSelectionPlan.length,
    },
    {
      id: "manifest-export",
      number: 3,
      title: "Manifest Export",
      count: readyToExportBatches.length,
    },
    {
      id: "helper-prep",
      number: 4,
      title: "Helper Prep",
      count: exportedBatches.length,
    },
    {
      id: "manual-flow-run",
      number: 5,
      title: "Manual Flow Run",
      count: runningBatches.length,
    },
    {
      id: "output-import",
      number: 6,
      title: "Output Import",
      count: importingBatches.length,
    },
    {
      id: "reconcile-close",
      number: 7,
      title: "Reconcile / Close",
      count: reconcileBatches.length,
    },
  ];

  const activeStep = workflowSteps.find((step) => step.count > 0) ?? workflowSteps[0];
  const workspaceId = state.currentWorkspace?.id ?? null;
  let defaultSelectionIndex = 0;
  const batchSelectionStatus =
    batchSelectionSkippedCount > 0
      ? `${batchSelectionReadyCount} pilih, ${batchSelectionSkippedCount} lewat`
      : stepCountLabel(batchSelectionReadyCount);

  return (
    <>
      <ControllerMobileRedirect />
      <div className="mobile-desktop-required">
        <h2>Flow Control memerlukan desktop</h2>
        <p>Buka di browser desktop untuk menggunakan Flow Control.</p>
      </div>
      <div className="stack controller-desktop-content">
        <header className="controller-workflow-header">
          <div className="controller-workflow-header__workspace">
            <span>Workspace aktif</span>
            <strong>{state.currentWorkspace?.workspace_name ?? "Belum dipilih"}</strong>
            <span>{state.currentWorkspace?.workspace_code ?? "Pilih workspace aktif dulu"}</span>
          </div>
          <div className="controller-workflow-header__badges">
            <StatusBadge
              status={`${state.flowBatches.length} batch`}
              tone="neutral"
              size="sm"
              variant="pill"
              muted
            />
            <StatusBadge
              status={availableFlowAccountCount ? `${availableFlowAccountCount} perkiraan siap` : "Belum ada perkiraan siap"}
              tone={availableFlowAccountCount ? "success" : "warning"}
              size="sm"
              variant="pill"
            />
          </div>
        </header>

        <div className="controller-stepper-shell">
          <ControllerWorkflowStepper
            aside={<FlowAccountSupportPanel accounts={state.flowAccounts} />}
            defaultActiveStepId={activeStep.id}
            steps={workflowSteps}
          >
            <ControllerStepSection title="Prompt Ready" status={stepCountLabel(generatedPromptPacks.length)}>
              {generatedPromptPacks.map((promptPack) => (
                <GeneratedPromptCard
                  key={promptPack.id}
                  productName={productName(promptPack.product_id, productMap)}
                  promptPack={promptPack}
                />
              ))}
              {!generatedPromptPacks.length ? <EmptyState title="Belum ada prompt." description="Buat prompt dulu." /> : null}
            </ControllerStepSection>

            <ControllerStepSection title="Batch Setup" status={batchSelectionStatus}>
              <form action={saveController} className="controller-batch-selection-form stack">
                <HiddenInput name="intent" value="create_flow_batch_many" />
                <HiddenInput name="workspace_id" value={workspaceId} />
                <HiddenInput name="target_date" value={todayInJakarta()} />
                <HiddenInput name="model" value="google-flow" />
                <HiddenInput name="status" value="READY_TO_EXPORT" />
                {batchSelectionPlan.map((planItem) => {
                  const promptPack = promptPackMap.get(planItem.promptPackId);

                  if (!promptPack) {
                    return null;
                  }

                  const defaultChecked = planItem.status === "READY" && defaultSelectionIndex++ < CONTROLLER_BATCH_SELECTION_DEFAULT_CAP;

                  return (
                    <BatchSelectionCard
                      defaultChecked={defaultChecked}
                      key={promptPack.id}
                      planItem={planItem}
                      productName={productName(promptPack.product_id, productMap)}
                      promptPack={promptPack}
                    />
                  );
                })}
                {!batchSelectionPlan.length ? <EmptyState title="Belum ada batch." description="Siapkan batch." /> : null}
                <div className="controller-action-row controller-batch-selection-actions">
                  <PendingActionButton className="compact primary" pendingLabel="Membuat" disabled={!batchSelectionPlan.length}>
                    <ListPlus size={15} aria-hidden="true" />
                    Buat batch terpilih
                  </PendingActionButton>
                </div>
              </form>
            </ControllerStepSection>

            <ControllerStepSection title="Manifest Export" status={stepCountLabel(readyToExportBatches.length)}>
              {readyToExportBatches.length ? (
                readyToExportBatches.map((batch) => (
                  <BatchCard
                    accountLabel={accountLabel(batch.flow_account_id, accountMap)}
                    flowAccountLaneKey={accountLaneKey(batch.flow_account_id, accountMap)}
                    batch={batch}
                    clipJobs={clipJobsByBatch.get(batch.id) ?? []}
                    generatedFileMap={generatedFilesByClipJob}
                    key={batch.id}
                    productName={productName(batch.product_id, productMap)}
                  />
                ))
              ) : (
                <EmptyState title="Belum ada batch siap ekspor." />
              )}
            </ControllerStepSection>

            <ControllerStepSection title="Helper Prep" status={stepCountLabel(exportedBatches.length)}>
              {exportedBatches.length ? (
                exportedBatches.map((batch) => (
                  <BatchCard
                    accountLabel={accountLabel(batch.flow_account_id, accountMap)}
                    flowAccountLaneKey={accountLaneKey(batch.flow_account_id, accountMap)}
                    batch={batch}
                    clipJobs={clipJobsByBatch.get(batch.id) ?? []}
                    generatedFileMap={generatedFilesByClipJob}
                    key={batch.id}
                    productName={productName(batch.product_id, productMap)}
                  />
                ))
              ) : (
                <EmptyState title="Belum ada batch diekspor." />
              )}
            </ControllerStepSection>

            <ControllerStepSection title="Manual Flow Run" status={stepCountLabel(runningBatches.length)}>
              {runningBatches.length ? (
                runningBatches.map((batch) => (
                  <BatchCard
                    accountLabel={accountLabel(batch.flow_account_id, accountMap)}
                    flowAccountLaneKey={accountLaneKey(batch.flow_account_id, accountMap)}
                    batch={batch}
                    clipJobs={clipJobsByBatch.get(batch.id) ?? []}
                    generatedFileMap={generatedFilesByClipJob}
                    key={batch.id}
                    productName={productName(batch.product_id, productMap)}
                  />
                ))
              ) : (
                <EmptyState title="Tidak ada batch berjalan." />
              )}
            </ControllerStepSection>

            <ControllerStepSection title="Output Import" status={stepCountLabel(importingBatches.length)}>
              {importingBatches.length ? (
                importingBatches.map((batch) => (
                  <BatchCard
                    accountLabel={accountLabel(batch.flow_account_id, accountMap)}
                    flowAccountLaneKey={accountLaneKey(batch.flow_account_id, accountMap)}
                    batch={batch}
                    clipJobs={clipJobsByBatch.get(batch.id) ?? []}
                    generatedFileMap={generatedFilesByClipJob}
                    key={batch.id}
                    productName={productName(batch.product_id, productMap)}
                  />
                ))
              ) : (
                <EmptyState title="Belum ada output." />
              )}
            </ControllerStepSection>

            <ControllerStepSection title="Reconcile / Close" status={stepCountLabel(reconcileBatches.length)}>
              {reconcileBatches.length ? (
                reconcileBatches.map((batch) => (
                  <BatchCard
                    accountLabel={accountLabel(batch.flow_account_id, accountMap)}
                    flowAccountLaneKey={accountLaneKey(batch.flow_account_id, accountMap)}
                    batch={batch}
                    clipJobs={clipJobsByBatch.get(batch.id) ?? []}
                    generatedFileMap={generatedFilesByClipJob}
                    key={batch.id}
                    productName={productName(batch.product_id, productMap)}
                  />
                ))
              ) : (
                <EmptyState title="Belum ada batch final." />
              )}
            </ControllerStepSection>
          </ControllerWorkflowStepper>
        </div>
      </div>
    </>
  );
}
