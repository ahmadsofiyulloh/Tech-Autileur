"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Check, Clock3, Edit3, ListChecks, Package, Square, Trash2, X } from "lucide-react";
import type { AffiliateProfilePromptReadinessInput } from "@/lib/affiliate-profiles/readiness";
import { PendingActionButton } from "@/components/operator/pending-action-button";
import { StatusBadge } from "@/components/operator/status-badge";
import { NativeButton, NativeLinkButton } from "@/components/ui/native-button";
import { unwrapJsonApiData, type JsonApiResponse } from "@/lib/api-response-contract";
import { OverflowActionMenu } from "@/components/ui/overflow-action-menu";
import { VariantSubmitButton } from "@/components/operator/variant-picker";
import { getPromptLaunchReadiness, type PromptLaunchReadiness } from "@/lib/prompts/prompt-launch-readiness";
import { type PromptReadinessProjection } from "@/lib/prompts/prompt-readiness-projection";
import {
  PROMPT_WORKBENCH_MOBILE_PAGE_SIZE,
  type PromptWorkbenchReadinessFilter,
} from "@/lib/prompts/prompt-workbench";
import type { PromptQueueSnapshot, PromptQueueSummary } from "@/lib/prompts/prompt-queue-contract";
import { bulkEnqueuePromptPacks, cancelPromptPackGeneration, savePromptPack } from "./actions";

const PROMPT_WORKBENCH_DESKTOP_MEDIA_QUERY = "(min-width: 1024px)";
const LONG_PRESS_DELAY_MS = 420;
const LONG_PRESS_MOVE_TOLERANCE_PX = 12;
const BULK_VARIANT_SELECTABLE_PROMPT_STATUSES = new Set([
  "READY_FOR_PROMPT",
  "PROMPT_QUEUED",
  "PROMPT_GENERATED",
  "PROMPT_FAILED",
]);

type PromptWorkbenchProduct = {
  id: string;
  product_name: string;
};

type PromptWorkbenchPromptPack = {
  id: string;
  product_id: string;
  version: number;
  status: string;
  ai_task_id: string | null;
  error_message: string | null;
};

type PromptWorkbenchIntakeSession = {
  id: string;
  status: string;
  reviewed_metadata_json: unknown;
};

type PromptWorkbenchAffiliateProfile = AffiliateProfilePromptReadinessInput & {
  id: string;
  profile_name: string;
};

type PromptWorkbenchSourceImage = {
  id: string;
  drive_item_ref_id: string | null;
};

type PromptWorkbenchDriveItem = {
  name: string;
};

type PromptWorkbenchTask = {
  status: string;
  error_message: string | null;
  gemini_api_key_id: string | null;
  gemini_key_label: string | null;
};

export type PromptWorkbenchRowData = {
  product: PromptWorkbenchProduct;
  latest_activity_at: string | null;
  latest_activity_label: string;
  workspaceName: string;
  promptPack: PromptWorkbenchPromptPack | null;
  intakeSession: PromptWorkbenchIntakeSession | null;
  affiliateProfile: PromptWorkbenchAffiliateProfile | null;
  sourceImage: PromptWorkbenchSourceImage | null;
  sourceImageDriveItem: PromptWorkbenchDriveItem | null;
  generationTask: PromptWorkbenchTask | null;
  promptReadiness: PromptReadinessProjection | null;
  defaultAffiliateProfileName: string;
  productContinueHref: string | null;
  productDetailHref: string;
  promptDetailHref: string | null;
  returnHref: string;
  isOpen: boolean;
};

type PromptWorkbenchListProps = {
  affiliateProfileId?: string | null;
  intakeId?: string | null;
  pagination: PromptWorkbenchPaginationState;
  productId?: string | null;
  queueHref: string;
  queueSummary: PromptQueueSummary;
  readiness: PromptWorkbenchReadinessFilter;
  rows: PromptWorkbenchRowData[];
  search: string;
};

type PromptWorkbenchPaginationState = {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};

type PromptPackCreateFormProps = {
  product: PromptWorkbenchProduct;
  intakeSession: PromptWorkbenchIntakeSession | null;
  affiliateProfile: PromptWorkbenchAffiliateProfile | null;
  sourceImage: PromptWorkbenchSourceImage | null;
  readiness: PromptLaunchReadiness;
};

type PromptWorkbenchRowCardProps = PromptWorkbenchRowData & {
  selected: boolean;
  selectionMode: boolean;
  onBeginSelection: (productId: string) => void;
  onToggleSelected: (productId: string) => void;
};

function isInteractiveChild(target: EventTarget | null) {
  const element = target instanceof HTMLElement ? target : null;
  return Boolean(element?.closest("a, button, input, select, textarea, form, [role='button']"));
}

function createLongPressHandlers({
  enabled,
  onLongPress,
}: {
  enabled: boolean;
  onLongPress: () => void;
}) {
  const state = {
    timer: null as number | null,
    startX: 0,
    startY: 0,
    triggered: false,
  };

  const clearTimer = () => {
    if (state.timer) {
      window.clearTimeout(state.timer);
      state.timer = null;
    }
  };

  return {
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => {
      if (!enabled || event.pointerType === "mouse" || isInteractiveChild(event.target)) {
        return;
      }

      state.startX = event.clientX;
      state.startY = event.clientY;
      state.triggered = false;
      clearTimer();
      state.timer = window.setTimeout(() => {
        state.triggered = true;
        onLongPress();
      }, LONG_PRESS_DELAY_MS);
    },
    onPointerMove: (event: React.PointerEvent<HTMLElement>) => {
      if (!state.timer) {
        return;
      }

      const deltaX = Math.abs(event.clientX - state.startX);
      const deltaY = Math.abs(event.clientY - state.startY);

      if (deltaX > LONG_PRESS_MOVE_TOLERANCE_PX || deltaY > LONG_PRESS_MOVE_TOLERANCE_PX) {
        clearTimer();
      }
    },
    onPointerUp: () => {
      clearTimer();
    },
    onPointerCancel: () => {
      clearTimer();
    },
    onContextMenu: (event: React.MouseEvent<HTMLElement>) => {
      if (state.triggered) {
        event.preventDefault();
      }
      state.triggered = false;
    },
    onClickCapture: (event: React.MouseEvent<HTMLElement>) => {
      if (state.triggered) {
        event.preventDefault();
        event.stopPropagation();
        state.triggered = false;
      }
    },
  };
}

function useIsDesktopPromptWorkbenchViewport() {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    if (!window.matchMedia) {
      setIsDesktop(false);
      return;
    }

    const media = window.matchMedia(PROMPT_WORKBENCH_DESKTOP_MEDIA_QUERY);
    const updateViewportState = () => setIsDesktop(media.matches);

    updateViewportState();
    media.addEventListener("change", updateViewportState);

    return () => media.removeEventListener("change", updateViewportState);
  }, []);

  return isDesktop;
}

function PromptPackCreateForm({ product, intakeSession, affiliateProfile, sourceImage, readiness }: PromptPackCreateFormProps) {
  const readinessId = `prompt-launch-readiness-${product.id}`;

  return (
    <VariantSubmitButton
      action={savePromptPack}
      buttonLabel="Buat Prompt"
      className="compact primary prompt-variant-launcher"
      disabled={!readiness.ready}
      hiddenFields={[
        { name: "intent", value: "create_generate" },
        { name: "status", value: "DRAFT" },
        { name: "version", value: 1 },
        { name: "product_id", value: product.id },
        { name: "intake_session_id", value: intakeSession?.id ?? "" },
        { name: "affiliate_profile_id", value: affiliateProfile?.id ?? "" },
        { name: "source_product_image_id", value: sourceImage?.id ?? "" },
      ]}
      pendingLabel="Membuat"
      pickerLabel="Pilih varian konten"
      ariaDescribedBy={!readiness.ready ? readinessId : undefined}
    />
  );
}

function PromptWorkbenchRowCard({
  product,
  promptPack,
  intakeSession,
  affiliateProfile,
  sourceImage,
  sourceImageDriveItem,
  generationTask,
  promptReadiness,
  latest_activity_label,
  defaultAffiliateProfileName,
  selected,
  selectionMode,
  onBeginSelection,
  onToggleSelected,
  productContinueHref,
  productDetailHref,
  promptDetailHref,
  returnHref,
  isOpen,
}: PromptWorkbenchRowCardProps) {
  const statusLabel = promptReadiness?.label ?? (promptPack ? promptPack.status : intakeSession?.status ?? "DRAFT");
  const statusKey = promptReadiness?.status ?? generationTask?.status ?? promptPack?.status ?? intakeSession?.status ?? "DRAFT";
  const promptLaunchReadiness = getPromptLaunchReadiness({
    productId: product.id,
    intakeSessionId: intakeSession?.id ?? null,
    affiliateProfileId: affiliateProfile?.id ?? null,
    hasReviewedMetadata: Boolean(intakeSession?.reviewed_metadata_json || intakeSession?.status === "REVIEWED"),
    reviewedMetadata: intakeSession?.reviewed_metadata_json ?? null,
    sourceImageDriveItemRefId: sourceImage?.drive_item_ref_id ?? null,
    affiliateProfile,
  });
  const isSelectable = Boolean(
    promptReadiness?.isBulkEnqueueEligible || (promptReadiness?.status && BULK_VARIANT_SELECTABLE_PROMPT_STATUSES.has(promptReadiness.status)),
  );
  const canCancelPromptGeneration = ["QUEUED", "RETRYING", "WAITING_FOR_KEY"].includes(generationTask?.status ?? "");
  const taskIssueMessage = generationTask?.error_message ?? promptPack?.error_message ?? null;
  const showErrorNote = Boolean(taskIssueMessage && (statusKey.includes("FAILED") || statusKey === "ERROR"));
  const canCreatePrompt = !promptPack && promptLaunchReadiness.ready;
  const continueHref = !promptPack && !promptLaunchReadiness.ready ? productContinueHref : null;
  const productActionHref = continueHref ?? productDetailHref;
  const productActionLabel = continueHref ? "Lanjutkan" : "Detail";
  const affiliateProfileLabel = affiliateProfile?.profile_name ?? defaultAffiliateProfileName;
  const sourceImageLabel = sourceImageDriveItem?.name ?? (sourceImage?.drive_item_ref_id ? "Gambar Drive" : "Gambar belum ada");
  const taskLabel = generationTask?.status ?? (promptPack ? promptPack.status : "Belum dibuat");

  const longPressHandlers = createLongPressHandlers({
    enabled: isSelectable && !selectionMode,
    onLongPress: () => onBeginSelection(product.id),
  });

  const handleMobileCardClick = selectionMode && isSelectable
    ? (event: React.MouseEvent<HTMLElement>) => {
        if (!isInteractiveChild(event.target)) {
          event.preventDefault();
          onToggleSelected(product.id);
        }
      }
    : undefined;

  const renderProductAction = () => (
    <>
      <NativeLinkButton className="compact primary" href={productActionHref}>
        <ArrowRight size={15} aria-hidden="true" />
        {productActionLabel}
      </NativeLinkButton>
      {continueHref ? (
        <OverflowActionMenu label="Aksi prompt">
          <NativeLinkButton className="compact" href={productDetailHref}>
            <ArrowRight size={15} aria-hidden="true" />
            Detail
          </NativeLinkButton>
        </OverflowActionMenu>
      ) : null}
    </>
  );
  const renderCreatePromptAction = () => (
    <>
      <PromptPackCreateForm
        affiliateProfile={affiliateProfile}
        intakeSession={intakeSession}
        product={product}
        readiness={promptLaunchReadiness}
        sourceImage={sourceImage}
      />
      <OverflowActionMenu label="Aksi prompt">
        <NativeLinkButton className="compact" href={productDetailHref}>
          <ArrowRight size={15} aria-hidden="true" />
          Detail
        </NativeLinkButton>
      </OverflowActionMenu>
    </>
  );

  return (
    <article
      className="prompt-list-card stack"
      data-open={isOpen ? "true" : undefined}
      data-selected={selected ? "true" : undefined}
      onClick={handleMobileCardClick}
      {...longPressHandlers}
    >
      <div className="prompt-list-card__header">
        <div className="prompt-list-card__copy">
          <span>{promptPack ? `Paket Prompt v${promptPack.version}` : "Paket Prompt"}</span>
          <strong title={product.product_name}>{product.product_name}</strong>
          <small>{latest_activity_label}</small>
        </div>
        <StatusBadge status={statusLabel} size="sm" />
      </div>

      <div className="prompt-list-card__desktop-context desktop-action-set" aria-label="Konteks prompt">
        <span>
          <small>Profil</small>
          <strong title={affiliateProfileLabel}>{affiliateProfileLabel}</strong>
        </span>
        <span>
          <small>Gambar</small>
          <strong title={sourceImageLabel}>{sourceImageLabel}</strong>
        </span>
        <span>
          <small>Task</small>
          <strong>{taskLabel}</strong>
        </span>
      </div>

      {isSelectable ? (
        <div className="prompt-list-card__meta-row desktop-action-set">
          <NativeButton
            aria-pressed={selected}
            className="compact tertiary prompt-workbench-select-button desktop-action-set"
            data-active={selected ? "true" : undefined}
            type="button"
            onClick={() => onToggleSelected(product.id)}
          >
            {selected ? <Check size={15} aria-hidden="true" /> : <Square size={15} aria-hidden="true" />}
            {selected ? "Dipilih" : "Pilih"}
          </NativeButton>
        </div>
      ) : null}

      {showErrorNote ? (
        <div className="prompt-list-card__task-note" aria-label="Error prompt">
          <span>Error</span>
          <strong>{taskIssueMessage}</strong>
        </div>
      ) : null}

      <div className="prompt-list-card__divider" aria-hidden="true" />

      <div className="prompt-list-card__actions prompt-list-card__desktop-actions desktop-action-set">
        {promptPack ? (
          <>
            <NativeLinkButton className="compact primary" href={promptDetailHref ?? `/prompts/${promptPack.id}`}>
              <Edit3 size={15} aria-hidden="true" />
              Buka
            </NativeLinkButton>
            <OverflowActionMenu label="Aksi prompt">
              <NativeLinkButton className="compact" href={productDetailHref}>
                <Package size={15} aria-hidden="true" />
                Produk
              </NativeLinkButton>
              <NativeLinkButton className="compact" href={`/prompts/${promptPack.id}/history`}>
                <Clock3 size={15} aria-hidden="true" />
                History
              </NativeLinkButton>
              {canCancelPromptGeneration ? (
                <form action={cancelPromptPackGeneration}>
                  <input type="hidden" name="return_to" value={returnHref} />
                  <input type="hidden" name="id" value={promptPack.id} />
                  <input type="hidden" name="product_id" value={promptPack.product_id} />
                  <PendingActionButton className="compact" pendingLabel="Membatalkan">
                    Batal
                  </PendingActionButton>
                </form>
              ) : null}
            </OverflowActionMenu>
          </>
        ) : (
          <>
            {canCreatePrompt ? renderCreatePromptAction() : renderProductAction()}
          </>
        )}
      </div>

      <div className="mobile-card-actions prompt-list-card__mobile-actions">
        {promptPack ? (
          <>
            <NativeLinkButton className="compact primary" href={promptDetailHref ?? `/prompts/${promptPack.id}`}>
              <Edit3 size={15} aria-hidden="true" />
              Buka
            </NativeLinkButton>
            <OverflowActionMenu>
              <NativeLinkButton className="compact" href={productDetailHref}>
                <Package size={15} aria-hidden="true" />
                Produk
              </NativeLinkButton>
              <NativeLinkButton className="compact" href={`/prompts/${promptPack.id}/history`}>
                <Clock3 size={15} aria-hidden="true" />
                History
              </NativeLinkButton>
              {canCancelPromptGeneration ? (
                <form action={cancelPromptPackGeneration}>
                  <input type="hidden" name="return_to" value={returnHref} />
                  <input type="hidden" name="id" value={promptPack.id} />
                  <input type="hidden" name="product_id" value={promptPack.product_id} />
                  <PendingActionButton className="compact" pendingLabel="Membatalkan">
                    Batal
                  </PendingActionButton>
                </form>
              ) : null}
            </OverflowActionMenu>
          </>
        ) : (
          <>
            {canCreatePrompt ? renderCreatePromptAction() : renderProductAction()}
          </>
        )}
      </div>
    </article>
  );
}

function derivePromptMobilePagination(totalCount: number): PromptWorkbenchPaginationState {
  const totalPages = Math.max(Math.ceil(totalCount / PROMPT_WORKBENCH_MOBILE_PAGE_SIZE), 1);

  return {
    page: 1,
    pageSize: PROMPT_WORKBENCH_MOBILE_PAGE_SIZE,
    totalCount,
    totalPages,
    hasPreviousPage: false,
    hasNextPage: totalPages > 1,
  };
}

export function PromptWorkbenchList({
  affiliateProfileId,
  rows,
  intakeId,
  pagination,
  productId,
  queueHref,
  queueSummary,
  readiness,
  search,
}: PromptWorkbenchListProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [mobileRows, setMobileRows] = useState<PromptWorkbenchRowData[]>(() => rows.slice(0, PROMPT_WORKBENCH_MOBILE_PAGE_SIZE));
  const [mobilePagination, setMobilePagination] = useState<PromptWorkbenchPaginationState>(() => derivePromptMobilePagination(pagination.totalCount));
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [liveQueueSummary, setLiveQueueSummary] = useState(queueSummary);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const isDesktopPromptWorkbenchViewport = useIsDesktopPromptWorkbenchViewport();
  const renderedRows = isDesktopPromptWorkbenchViewport ? rows : mobileRows;
  const selectableRowIds = useMemo(
    () => new Set(rows.filter((row) => row.promptReadiness?.isBulkEnqueueEligible).map((row) => row.product.id)),
    [rows],
  );
  const selectedCount = selectedIds.size;
  const selectedProductIds = Array.from(selectedIds);
  const activeTaskCount = liveQueueSummary.queued + liveQueueSummary.running + liveQueueSummary.retrying + liveQueueSummary.waitingForKey;

  useEffect(() => {
    setMobileRows(rows.slice(0, PROMPT_WORKBENCH_MOBILE_PAGE_SIZE));
    setMobilePagination(derivePromptMobilePagination(pagination.totalCount));
    setLoadMoreError(null);
  }, [pagination.totalCount, readiness, rows, search]);

  useEffect(() => {
    setLiveQueueSummary(queueSummary);
  }, [queueSummary]);

  useEffect(() => {
    if (!isDesktopPromptWorkbenchViewport) {
      return;
    }

    const intervalId = window.setInterval(async () => {
      try {
        const response = await fetch("/api/prompts/queue", {
          headers: {
            accept: "application/json",
          },
          cache: "no-store",
        });
        const payload = (await response.json()) as unknown;

        if (response.ok) {
          const data = unwrapJsonApiData<PromptQueueSnapshot>(payload as PromptQueueSnapshot | JsonApiResponse<PromptQueueSnapshot>);
          setLiveQueueSummary(data.summary);
        }
      } catch {
        // Keep the last known summary in the compact workbench bar.
      }
    }, 5_000);

    return () => window.clearInterval(intervalId);
  }, [isDesktopPromptWorkbenchViewport]);

  useEffect(() => {
    setSelectedIds((current) => {
      if (!current.size) {
        return current;
      }

      const next = new Set(Array.from(current).filter((id) => selectableRowIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [selectableRowIds]);

  useEffect(() => {
    if (selectionMode && selectedIds.size === 0) {
      setSelectionMode(false);
    }
  }, [selectionMode, selectedIds.size]);

  const beginSelection = useCallback((productId: string) => {
    if (!selectableRowIds.has(productId)) {
      return;
    }

    setSelectionMode(true);
    setSelectedIds((current) => {
      const next = new Set(current);
      next.add(productId);
      return next;
    });
  }, [selectableRowIds]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  function toggleSelected(productId: string) {
    if (!selectableRowIds.has(productId)) {
      return;
    }

    setSelectedIds((current) => {
      const next = new Set(current);

      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }

      return next;
    });
  }

  const loadMorePrompts = useCallback(async () => {
    if (isLoadingMore || !mobilePagination.hasNextPage) {
      return;
    }

    setIsLoadingMore(true);
    setLoadMoreError(null);

    try {
      const params = new URLSearchParams();

      if (affiliateProfileId) {
        params.set("affiliate_profile_id", affiliateProfileId);
      }

      if (productId) {
        params.set("product_id", productId);
      }

      if (intakeId) {
        params.set("intake_id", intakeId);
      }

      if (readiness !== "ALL") {
        params.set("readiness", readiness);
      }

      if (search) {
        params.set("q", search);
      }

      params.set("page", String(mobilePagination.page + 1));
      params.set("page_size", String(PROMPT_WORKBENCH_MOBILE_PAGE_SIZE));

      const response = await fetch(`/api/prompts/workbench?${params.toString()}`, {
        headers: {
          accept: "application/json",
        },
      });
      const payload = (await response.json()) as {
        error?: string;
        pagination?: PromptWorkbenchPaginationState;
        rows?: PromptWorkbenchRowData[];
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Prompt gagal dimuat.");
      }

      setMobileRows((current) => {
        const existingIds = new Set(current.map((row) => row.product.id));
        const nextRows = (payload.rows ?? []).filter((row) => !existingIds.has(row.product.id));
        return [...current, ...nextRows];
      });
      setMobilePagination(payload.pagination ?? mobilePagination);
    } catch (error) {
      setLoadMoreError(error instanceof Error ? error.message : "Prompt gagal dimuat.");
    } finally {
      setIsLoadingMore(false);
    }
  }, [
    affiliateProfileId,
    intakeId,
    isLoadingMore,
    mobilePagination,
    productId,
    readiness,
    search,
  ]);

  useEffect(() => {
    if (isDesktopPromptWorkbenchViewport || !mobilePagination.hasNextPage || !loadMoreRef.current) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadMorePrompts();
        }
      },
      {
        rootMargin: "240px 0px",
      },
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [isDesktopPromptWorkbenchViewport, loadMorePrompts, mobilePagination.hasNextPage]);

  return (
    <>
      <div
        className="settings-inline-summary prompt-workbench-selection-summary desktop-action-set"
        role="group"
        aria-label="Aksi bulk prompt"
      >
        <div className="prompt-workbench-selection-summary__copy">
          <span aria-live="polite">{selectedCount} dipilih</span>
          {activeTaskCount ? <StatusBadge status={`${activeTaskCount} task aktif`} tone="info" /> : null}
        </div>
        <div className="prompt-workbench-selection-summary__actions">
          <NativeLinkButton className="compact tertiary" href={queueHref}>
            <ListChecks size={15} aria-hidden="true" />
            Antrian
          </NativeLinkButton>
          {selectedCount ? (
            <NativeButton
              aria-label="Bersihkan pilihan"
              className="compact tertiary icon-only"
              type="button"
              onClick={clearSelection}
            >
              <X size={15} aria-hidden="true" />
            </NativeButton>
          ) : null}
          <VariantSubmitButton
            action={bulkEnqueuePromptPacks}
            buttonLabel="Antrikan"
            className="compact primary prompt-workbench-enqueue-placeholder"
            disabled={!selectedCount}
            hiddenFields={[
              { name: "return_to", value: queueHref },
              { name: "generation_mode", value: "gemini" },
              ...selectedProductIds.map((selectedProductId) => ({
                name: "product_ids",
                value: selectedProductId,
              })),
            ]}
            pendingLabel="Mengantrikan"
            pickerLabel="Pilih varian konten"
          />
        </div>
      </div>

      <section className="stack prompt-list-stack">
        <div className="prompt-workbench-table-head desktop-action-set" aria-hidden="true">
          <span>Produk</span>
          <span>Konteks</span>
          <span>Pilih</span>
          <span>Aksi</span>
        </div>
        {renderedRows.map((row) => (
          <PromptWorkbenchRowCard
            {...row}
            key={row.product.id}
            onBeginSelection={beginSelection}
            onToggleSelected={toggleSelected}
            selected={selectedIds.has(row.product.id)}
            selectionMode={selectionMode}
          />
        ))}
        {loadMoreError ? <section className="muted-box">{loadMoreError}</section> : null}
        <div ref={loadMoreRef} aria-hidden="true" />
        {!isDesktopPromptWorkbenchViewport && mobilePagination.hasNextPage ? (
          <NativeButton className="compact tertiary product-mobile-load-more" type="button" onClick={() => void loadMorePrompts()} disabled={isLoadingMore}>
            {isLoadingMore ? "Memuat" : "Muat lagi"}
          </NativeButton>
        ) : null}
      </section>

      {selectionMode ? (
        <div className="product-selection-summary product-selection-summary--mobile" role="group" aria-label="Aksi bulk prompt mobile">
          <div className="product-selection-summary__copy">
            <span aria-live="polite">{selectedCount} dipilih</span>
          </div>
          <div className="product-selection-summary__actions">
            <NativeButton
              aria-label={selectedCount > 0 ? "Bersihkan pilihan" : "Keluar mode seleksi"}
              className="compact tertiary icon-only"
              type="button"
              onClick={selectedCount > 0 ? clearSelection : exitSelectionMode}
            >
              <Trash2 size={15} aria-hidden="true" />
            </NativeButton>
            <VariantSubmitButton
              action={bulkEnqueuePromptPacks}
              buttonLabel="Antrikan"
              className="compact primary"
              disabled={!selectedCount}
              hiddenFields={[
                { name: "return_to", value: queueHref },
                { name: "generation_mode", value: "gemini" },
                ...selectedProductIds.map((selectedProductId) => ({
                  name: "product_ids",
                  value: selectedProductId,
                })),
              ]}
              pendingLabel="Mengantrikan"
              pickerLabel="Pilih varian konten"
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
