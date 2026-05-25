"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Clock3, Edit3, Package, Plus } from "lucide-react";
import type { AffiliateProfilePromptReadinessInput } from "@/lib/affiliate-profiles/readiness";
import { StatusBadge } from "@/components/operator/status-badge";
import { NativeButton, NativeLinkButton } from "@/components/ui/native-button";
import { OverflowActionMenu } from "@/components/ui/overflow-action-menu";
import { getPromptLaunchReadiness } from "@/lib/prompts/prompt-launch-readiness";
import { type PromptReadinessProjection } from "@/lib/prompts/prompt-readiness-projection";
import {
  PROMPT_WORKBENCH_MOBILE_PAGE_SIZE,
  type PromptWorkbenchReadinessFilter,
} from "@/lib/prompts/prompt-workbench";

const PROMPT_WORKBENCH_DESKTOP_MEDIA_QUERY = "(min-width: 1024px)";

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
  promptDetailHref: string;
  promptGenerateHref: string;
  promptHistoryHref: string;
  returnHref: string;
  isOpen: boolean;
};

type PromptWorkbenchListProps = {
  affiliateProfileId?: string | null;
  intakeId?: string | null;
  pagination: PromptWorkbenchPaginationState;
  productId?: string | null;
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

type PromptWorkbenchRowCardProps = PromptWorkbenchRowData;

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

function PromptPackCreateLink({ href, ariaDescribedBy, disabled }: { href: string; ariaDescribedBy?: string; disabled?: boolean }) {
  if (disabled) {
    return (
      <NativeButton
        aria-describedby={ariaDescribedBy}
        className="compact primary prompt-variant-launcher"
        disabled
        type="button"
      >
        <Plus size={15} aria-hidden="true" />
        Buat Prompt
      </NativeButton>
    );
  }

  return (
    <NativeLinkButton className="compact primary prompt-variant-launcher" href={href}>
      <Plus size={15} aria-hidden="true" />
      Buat Prompt
    </NativeLinkButton>
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
  productContinueHref,
  productDetailHref,
  promptDetailHref,
  promptGenerateHref,
  promptHistoryHref,
  isOpen,
}: PromptWorkbenchRowCardProps) {
  const statusLabel = promptReadiness?.label ?? (promptPack ? promptPack.status : intakeSession?.status ?? "DRAFT");
  const statusKey = promptReadiness?.status ?? generationTask?.status ?? promptPack?.status ?? intakeSession?.status ?? "DRAFT";
  const readinessId = `prompt-launch-readiness-${product.id}`;
  const promptLaunchReadiness = getPromptLaunchReadiness({
    productId: product.id,
    intakeSessionId: intakeSession?.id ?? null,
    affiliateProfileId: affiliateProfile?.id ?? null,
    hasReviewedMetadata: Boolean(intakeSession?.reviewed_metadata_json || intakeSession?.status === "REVIEWED"),
    reviewedMetadata: intakeSession?.reviewed_metadata_json ?? null,
    sourceImageDriveItemRefId: sourceImage?.drive_item_ref_id ?? null,
    affiliateProfile,
  });
  const taskIssueMessage = generationTask?.error_message ?? promptPack?.error_message ?? null;
  const showErrorNote = Boolean(taskIssueMessage && (statusKey.includes("FAILED") || statusKey === "ERROR"));
  const canCreatePrompt = !promptPack && promptLaunchReadiness.ready;
  const continueHref = !promptPack && !promptLaunchReadiness.ready ? productContinueHref : null;
  const productActionHref = continueHref ?? productDetailHref;
  const productActionLabel = continueHref ? "Lanjutkan" : "Detail";
  const affiliateProfileLabel = affiliateProfile?.profile_name ?? defaultAffiliateProfileName;
  const sourceImageLabel = sourceImageDriveItem?.name ?? (sourceImage?.drive_item_ref_id ? "Gambar Drive" : "Gambar belum ada");
  const taskLabel = generationTask?.status ?? (promptPack ? promptPack.status : "Belum dibuat");

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
      <PromptPackCreateLink
        ariaDescribedBy={!promptLaunchReadiness.ready ? readinessId : undefined}
        disabled={!promptLaunchReadiness.ready}
        href={promptGenerateHref}
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

      <div className="prompt-list-card__meta-row desktop-action-set">
        <StatusBadge status={taskLabel} size="sm" tone={generationTask ? "info" : "neutral"} />
      </div>

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
            <NativeLinkButton className="compact primary" href={promptDetailHref}>
              <Edit3 size={15} aria-hidden="true" />
              Buka
            </NativeLinkButton>
            <OverflowActionMenu label="Aksi prompt">
              <NativeLinkButton className="compact" href={promptGenerateHref}>
                <Plus size={15} aria-hidden="true" />
                Generate
              </NativeLinkButton>
              <NativeLinkButton className="compact" href={productDetailHref}>
                <Package size={15} aria-hidden="true" />
                Produk
              </NativeLinkButton>
              <NativeLinkButton className="compact" href={promptHistoryHref}>
                <Clock3 size={15} aria-hidden="true" />
                History
              </NativeLinkButton>
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
            <NativeLinkButton className="compact primary" href={promptDetailHref}>
              <Edit3 size={15} aria-hidden="true" />
              Buka
            </NativeLinkButton>
            <OverflowActionMenu>
              <NativeLinkButton className="compact" href={promptGenerateHref}>
                <Plus size={15} aria-hidden="true" />
                Generate
              </NativeLinkButton>
              <NativeLinkButton className="compact" href={productDetailHref}>
                <Package size={15} aria-hidden="true" />
                Produk
              </NativeLinkButton>
              <NativeLinkButton className="compact" href={promptHistoryHref}>
                <Clock3 size={15} aria-hidden="true" />
                History
              </NativeLinkButton>
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
  readiness,
  search,
}: PromptWorkbenchListProps) {
  const [mobileRows, setMobileRows] = useState<PromptWorkbenchRowData[]>(() => rows.slice(0, PROMPT_WORKBENCH_MOBILE_PAGE_SIZE));
  const [mobilePagination, setMobilePagination] = useState<PromptWorkbenchPaginationState>(() => derivePromptMobilePagination(pagination.totalCount));
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const isDesktopPromptWorkbenchViewport = useIsDesktopPromptWorkbenchViewport();
  const renderedRows = isDesktopPromptWorkbenchViewport ? rows : mobileRows;

  useEffect(() => {
    setMobileRows(rows.slice(0, PROMPT_WORKBENCH_MOBILE_PAGE_SIZE));
    setMobilePagination(derivePromptMobilePagination(pagination.totalCount));
    setLoadMoreError(null);
  }, [pagination.totalCount, readiness, rows, search]);

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

  return (
    <section className="stack prompt-list-stack">
      <div className="prompt-workbench-table-head desktop-action-set" aria-hidden="true">
        <span>Produk</span>
        <span>Konteks</span>
        <span>Task</span>
        <span>Aksi</span>
      </div>
      {renderedRows.map((row) => (
        <PromptWorkbenchRowCard
          {...row}
          key={row.product.id}
        />
      ))}
      {loadMoreError ? <section className="muted-box">{loadMoreError}</section> : null}
      {!isDesktopPromptWorkbenchViewport && mobilePagination.hasNextPage ? (
        <NativeButton className="compact tertiary product-mobile-load-more" type="button" onClick={() => void loadMorePrompts()} disabled={isLoadingMore}>
          {isLoadingMore ? "Memuat" : "Muat lagi"}
        </NativeButton>
      ) : null}
    </section>
  );
}
