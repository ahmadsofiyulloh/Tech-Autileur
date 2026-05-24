"use client";

import Link from "next/link";
import { ShareInputForm } from "./share-input-form";
import { ShareOutputTab } from "./share-output-tab";
import { ShareHistoryTab } from "./share-history-tab";
import type { SharePlatform } from "@/lib/share/share-platform";
import type { ShareAngle } from "@/lib/share/share-platform";
import type { ShareListRow, ShareTab } from "@/lib/share/share-list-contract";
import { buildShareListHref } from "@/lib/share/share-list-contract";
import type { ShareGenerationRecord } from "@/lib/server/share-generations";

type ShareDetailPanelProps = {
  action: (formData: FormData) => void;
  generations: ShareGenerationRecord[];
  latestGeneration: ShareGenerationRecord | null;
  platform: SharePlatform;
  prefillAngle?: ShareAngle | null;
  prefillVariantCount?: number | null;
  product: ShareListRow;
  selectedGeneration: ShareGenerationRecord | null;
  selectedTab: ShareTab;
  selectedVersionId?: string | null;
};

const shareTabs = [
  { key: "output", label: "Output" },
  { key: "generate", label: "Generate" },
  { key: "history", label: "History" },
] as const;

export function ShareDetailPanel({
  action,
  generations,
  latestGeneration,
  platform,
  prefillAngle,
  prefillVariantCount,
  product,
  selectedGeneration,
  selectedTab,
  selectedVersionId,
}: ShareDetailPanelProps) {
  const effectiveTab: ShareTab =
    !latestGeneration && selectedTab !== "generate" ? "generate" : selectedTab;

  return (
    <div className="share-detail-panel">
      <nav className="tab-nav tab-nav--flush" aria-label="Tab share detail">
        {shareTabs.map((tab) => {
          const href = buildShareListHref({
            platform,
            detailId: product.id,
            tab: tab.key,
          });

          return (
            <Link
              aria-current={effectiveTab === tab.key ? "page" : undefined}
              className="tab-link"
              data-active={effectiveTab === tab.key ? "true" : undefined}
              href={href}
              key={tab.key}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {effectiveTab === "output" && latestGeneration ? (
        <ShareOutputTab
          generation={selectedGeneration ?? latestGeneration}
          latestGenerationId={latestGeneration.id}
          isViewingOldVersion={Boolean(
            selectedVersionId && selectedVersionId !== latestGeneration.id,
          )}
          platform={platform}
          productId={product.id}
          affiliateUrl={product.affiliate_url}
        />
      ) : null}

      {effectiveTab === "generate" ? (
        <ShareInputForm
          action={action}
          platform={platform}
          prefillAngle={prefillAngle}
          prefillVariantCount={prefillVariantCount}
          product={product}
        />
      ) : null}

      {effectiveTab === "history" ? (
        <ShareHistoryTab
          activeGenerationId={selectedGeneration?.id ?? latestGeneration?.id ?? null}
          generations={generations}
          platform={platform}
          productId={product.id}
        />
      ) : null}
    </div>
  );
}
