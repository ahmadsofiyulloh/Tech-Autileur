import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { ArrowRight, ExternalLink, FileJson, MonitorPlay, Plus, RefreshCcw, Workflow } from "lucide-react";
import { EmptyState } from "@/components/operator/empty-state";
import { PendingActionButton } from "@/components/operator/pending-action-button";
import { SectionCard } from "@/components/operator/section-card";
import { StatusBadge } from "@/components/operator/status-badge";
import { NativeAnchorButton, NativeLinkButton } from "@/components/ui/native-button";
import { getControllerDashboardState } from "@/lib/server/controller";
import type { FlowBatchRecord, FlowBatchStatus } from "@/lib/server/flow-batches";
import type { FlowAccountPoolRecord } from "@/lib/server/flow-accounts";
import type { ClipJobRecord, GeneratedFileRecord } from "@/lib/server/clip-jobs";
import { saveController } from "./actions";
import { ControllerMobileRedirect } from "./controller-mobile-redirect";

export const dynamic = "force-dynamic";

const PROMPT_READY_BATCH_STATUSES = new Set<FlowBatchStatus>(["READY_TO_EXPORT", "EXPORTED"]);
const FLOW_RUNNING_BATCH_STATUSES = new Set<FlowBatchStatus>(["RUNNING"]);
const OUTPUT_BATCH_STATUSES = new Set<FlowBatchStatus>(["IMPORTING", "PARTIALLY_IMPORTED", "IMPORTED", "NEED_MANUAL_MATCH"]);
const CLOSED_BATCH_STATUSES = new Set<FlowBatchStatus>(["CLOSED"]);
const IMPORTED_MATCH_STATUSES = new Set(["MATCHED", "IMPORTED"]);
const REVIEW_MATCH_STATUSES = new Set(["NEEDS_REVIEW", "UNMATCHED"]);
const ERROR_MATCH_STATUSES = new Set(["ERROR"]);
const FLOW_STAGE_NAMES = ["FIRST_FRAME", "LAST_FRAME", "VIDEO"] as const;

type FlowStageName = (typeof FLOW_STAGE_NAMES)[number];

function isMobileUserAgent(userAgent: string) {
  return /mobi|android|iphone|ipad|ipod/i.test(userAgent);
}

function formatActionTime(value: string | null | undefined) {
  if (!value) {
    return "Belum ada aksi";
  }

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

function todayInJakarta() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
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

function stageStatusTone(summary: ReturnType<typeof summarizeStageImports>) {
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
              {summary.review ? <StatusBadge status={`${summary.review} review`} tone="warning" /> : null}
              {summary.waiting ? <StatusBadge status={`${summary.waiting} belum`} tone="neutral" /> : null}
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

function FlowAccountSupportPanel({ accounts }: { accounts: FlowAccountPoolRecord[] }) {
  return (
    <details className="controller-support-panel panel">
      <summary>
        <span>Akun Flow</span>
        <StatusBadge status={`${accounts.length} akun`} tone="neutral" />
      </summary>
      <div className="controller-support-panel__body stack">
        {accounts.length ? (
          <ul className="list controller-account-list">
            {accounts.map((account) => (
              <li key={account.id}>
                <div className="controller-list-row">
                  <div className="stack-tight">
                    <strong>{account.account_type}</strong>
                    <span>{account.account_code}</span>
                  </div>
                  <div className="controller-inline-badges">
                    <StatusBadge status={account.status} />
                    <StatusBadge status={`${account.credits_remaining} kredit`} tone={account.is_available ? "success" : "warning"} />
                    <StatusBadge status={`${account.slots_remaining} slot`} tone={account.is_available ? "success" : "warning"} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="Akun Flow belum ada." description="Tambah akun Flow." />
        )}
        <form action={saveController} className="controller-inline-form">
          <HiddenInput name="intent" value="create_flow_account" />
          <HiddenInput name="account_type" value="FLOW_FREE" />
          <HiddenInput name="observed_daily_credit" value="50" />
          <HiddenInput name="credit_per_generation" value="10" />
          <HiddenInput name="max_parallel_allowed" value="1" />
          <HiddenInput name="cooldown_minutes" value="0" />
          <HiddenInput name="status" value="ACTIVE" />
          <PendingActionButton className="compact primary" pendingLabel="Menambah">
            <Plus size={15} aria-hidden="true" />
            Tambah akun
          </PendingActionButton>
        </form>
      </div>
    </details>
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
    <article className="controller-lane-card">
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
          <ArrowRight size={15} aria-hidden="true" />
          Siapkan Flow
        </PendingActionButton>
      </form>
    </article>
  );
}

function ReadyPromptCard({
  promptPack,
  productName,
  workspaceId,
  recommendedAccount,
}: {
  promptPack: { id: string; product_id: string; prompt_code: string; version: number; status: string; updated_at: string };
  productName: string;
  workspaceId: string | null;
  recommendedAccount: FlowAccountPoolRecord | null;
}) {
  return (
    <article className="controller-lane-card">
      <div className="controller-lane-card__header">
        <div className="stack-tight">
          <strong>{productName}</strong>
          <span>{`Paket ${promptPack.prompt_code} v${promptPack.version}`}</span>
        </div>
        <StatusBadge status="Prompt Siap" tone="success" />
      </div>
      <div className="controller-lane-card__meta">
        <span>{recommendedAccount ? `${recommendedAccount.account_type} / ${recommendedAccount.credits_remaining} kredit` : "Akun Flow belum siap"}</span>
        <span>{formatActionTime(promptPack.updated_at)}</span>
      </div>
      <form action={saveController} className="controller-inline-form">
        <HiddenInput name="intent" value="create_flow_batch" />
        <HiddenInput name="workspace_id" value={workspaceId} />
        <HiddenInput name="product_id" value={promptPack.product_id} />
        <HiddenInput name="prompt_pack_id" value={promptPack.id} />
        <HiddenInput name="flow_account_id" value={recommendedAccount?.id ?? ""} />
        <HiddenInput name="target_date" value={todayInJakarta()} />
        <HiddenInput name="model" value="google-flow" />
        <HiddenInput name="status" value="READY_TO_EXPORT" />
        <HiddenInput name="confirm_flow_account" value="on" />
        <PendingActionButton className="compact primary" disabled={!recommendedAccount} pendingLabel="Membuat">
          <ArrowRight size={15} aria-hidden="true" />
          Konfirmasi batch
        </PendingActionButton>
      </form>
    </article>
  );
}

function ExportManifestPanel({ batch }: { batch: FlowBatchRecord }) {
  return (
    <details className="controller-manifest-panel muted-box">
      <summary>
        <span>Manifest</span>
        <StatusBadge status={batch.manifest_json ? "Tersedia" : "Belum"} tone={batch.manifest_json ? "success" : "warning"} />
      </summary>
      <form action={saveController} className="controller-manifest-panel__body stack">
        <HiddenInput name="intent" value="export_flow_manifest" />
        <HiddenInput name="id" value={batch.id} />
        <label className="auth-field">
          <span>Flow URL</span>
          <input name="flow_url" defaultValue={batch.flow_url ?? ""} placeholder="https://labs.google.com/fx/tools/flow" />
        </label>
        <div className="grid two-up">
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
        <div className="controller-action-row">
          <PendingActionButton className="compact primary" pendingLabel="Mengekspor">
            <FileJson size={15} aria-hidden="true" />
            Ekspor Manifest
          </PendingActionButton>
          {batch.manifest_json ? (
            <NativeLinkButton className="compact tertiary" href={`/controller/batches/${batch.id}/manifest`}>
              <FileJson size={15} aria-hidden="true" />
              Unduh
            </NativeLinkButton>
          ) : null}
          {batch.flow_url ? (
            <NativeAnchorButton className="compact tertiary" href={batch.flow_url} rel="noreferrer" target="_blank">
              <ExternalLink size={15} aria-hidden="true" />
              Buka Flow
            </NativeAnchorButton>
          ) : null}
        </div>
      </form>
    </details>
  );
}

function BatchCard({
  batch,
  productName,
  accountLabel,
  clipJobs,
  generatedFileMap,
}: {
  batch: FlowBatchRecord;
  productName: string;
  accountLabel: string;
  clipJobs: ClipJobRecord[];
  generatedFileMap: Map<string, GeneratedFileRecord[]>;
}) {
  const clipCount = clipJobs.length || Math.min(batch.max_jobs || 2, 2);
  const canStart = batch.status === "EXPORTED" || batch.status === "READY_TO_EXPORT";
  const canMarkImported = OUTPUT_BATCH_STATUSES.has(batch.status) || batch.status === "RUNNING";
  const canClose = batch.status !== "CLOSED";

  return (
    <article className="controller-lane-card">
      <div className="controller-lane-card__header">
        <div className="stack-tight">
          <strong>{productName}</strong>
          <span>{batch.batch_code}</span>
        </div>
        <StatusBadge status={batch.status} />
      </div>
      <div className="controller-lane-card__meta">
        <span>{accountLabel}</span>
        <span>{`${clipCount} clip`}</span>
        <span>{formatActionTime(batch.updated_at)}</span>
      </div>
      <StageImportRows clipJobs={clipJobs} generatedFileMap={generatedFileMap} clipCount={clipCount} />
      {PROMPT_READY_BATCH_STATUSES.has(batch.status) ? <ExportManifestPanel batch={batch} /> : null}
      <div className="controller-action-row">
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
              <RefreshCcw size={15} aria-hidden="true" />
              Tandai Masuk
            </PendingActionButton>
          </form>
        ) : null}
        {canClose ? (
          <form action={saveController}>
            <HiddenInput name="intent" value="archive_flow_batch" />
            <HiddenInput name="id" value={batch.id} />
            <PendingActionButton className="compact tertiary" pendingLabel="Menutup">
              Tutup
            </PendingActionButton>
          </form>
        ) : null}
      </div>
    </article>
  );
}

function ControllerLane({
  title,
  status,
  children,
}: {
  title: string;
  status: string;
  children: ReactNode;
}) {
  return (
    <SectionCard className="controller-lane" title={title} actions={<StatusBadge status={status} tone="neutral" />}>
      <div className="controller-lane__body">{children}</div>
    </SectionCard>
  );
}

export default async function ControllerPage() {
  const requestHeaders = await headers();

  if (isMobileUserAgent(requestHeaders.get("user-agent") ?? "")) {
    redirect("/products/new");
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
  const openPromptPackBatchIds = new Set(
    state.flowBatches
      .filter((batch) => batch.prompt_pack_id && batch.status !== "CLOSED")
      .map((batch) => batch.prompt_pack_id as string),
  );
  const recommendedAccount = state.flowAccounts.find((account) => account.is_available) ?? null;
  const generatedPromptPacks = state.promptPacks.filter(
    (promptPack) => promptPack.status === "GENERATED" && !openPromptPackBatchIds.has(promptPack.id),
  );
  const readyPromptPacks = state.readyPromptPacks.filter((promptPack) => !openPromptPackBatchIds.has(promptPack.id));
  const clipJobsByBatch = groupClipJobsByBatch(state.clipJobs);
  const generatedFilesByClipJob = groupGeneratedFilesByClipJob(state.generatedFiles);
  const readyBatches = state.flowBatches.filter((batch) => PROMPT_READY_BATCH_STATUSES.has(batch.status));
  const runningBatches = state.flowBatches.filter((batch) => FLOW_RUNNING_BATCH_STATUSES.has(batch.status));
  const outputBatches = state.flowBatches.filter((batch) => OUTPUT_BATCH_STATUSES.has(batch.status));
  const closedBatches = state.flowBatches.filter((batch) => CLOSED_BATCH_STATUSES.has(batch.status));
  const workspaceId = state.currentWorkspace?.id ?? null;

  return (
    <>
      <ControllerMobileRedirect />
      <div className="stack controller-desktop-content">
        <div className="settings-inline-summary">
          <span>{state.currentWorkspace?.workspace_name ?? "Workspace aktif"}</span>
          <StatusBadge status={`${state.flowBatches.length} batch`} tone="neutral" />
          <StatusBadge status={recommendedAccount ? "Akun tersedia" : "Akun belum siap"} tone={recommendedAccount ? "success" : "warning"} />
        </div>

        <FlowAccountSupportPanel accounts={state.flowAccounts} />

        <section className="controller-board" aria-label="Flow Control">
          <ControllerLane title="Prompt Siap" status={`${generatedPromptPacks.length + readyPromptPacks.length + readyBatches.length} item`}>
            {generatedPromptPacks.map((promptPack) => (
              <GeneratedPromptCard
                key={promptPack.id}
                productName={productName(promptPack.product_id, productMap)}
                promptPack={promptPack}
              />
            ))}
            {readyPromptPacks.map((promptPack) => (
              <ReadyPromptCard
                key={promptPack.id}
                productName={productName(promptPack.product_id, productMap)}
                promptPack={promptPack}
                recommendedAccount={recommendedAccount}
                workspaceId={workspaceId}
              />
            ))}
            {readyBatches.map((batch) => (
              <BatchCard
                accountLabel={accountLabel(batch.flow_account_id, accountMap)}
                batch={batch}
                clipJobs={clipJobsByBatch.get(batch.id) ?? []}
                generatedFileMap={generatedFilesByClipJob}
                key={batch.id}
                productName={productName(batch.product_id, productMap)}
              />
            ))}
            {!generatedPromptPacks.length && !readyPromptPacks.length && !readyBatches.length ? (
              <EmptyState title="Belum ada prompt siap." description="Buat prompt dulu." />
            ) : null}
          </ControllerLane>

          <ControllerLane title="Sedang Flow" status={`${runningBatches.length} batch`}>
            {runningBatches.length ? (
              runningBatches.map((batch) => (
                <BatchCard
                  accountLabel={accountLabel(batch.flow_account_id, accountMap)}
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
          </ControllerLane>

          <ControllerLane title="Output Masuk" status={`${outputBatches.length} batch`}>
            {outputBatches.length ? (
              outputBatches.map((batch) => (
                <BatchCard
                  accountLabel={accountLabel(batch.flow_account_id, accountMap)}
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
          </ControllerLane>

          <ControllerLane title="Selesai" status={`${closedBatches.length} batch`}>
            {closedBatches.length ? (
              closedBatches.map((batch) => (
                <BatchCard
                  accountLabel={accountLabel(batch.flow_account_id, accountMap)}
                  batch={batch}
                  clipJobs={clipJobsByBatch.get(batch.id) ?? []}
                  generatedFileMap={generatedFilesByClipJob}
                  key={batch.id}
                  productName={productName(batch.product_id, productMap)}
                />
              ))
            ) : (
              <EmptyState title="Belum ada batch selesai." />
            )}
          </ControllerLane>
        </section>
      </div>
    </>
  );
}
