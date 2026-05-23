"use client";

import Link from "next/link";
import { ShareInputForm } from "./share-input-form";
import { ShareOutputTab } from "./share-output-tab";
import { ShareHistoryTab } from "./share-history-tab";
import type { SharePlatform } from "@/lib/share/share-platform";
import type { ShareAngle } from "@/lib/share/share-platform";
import type { ShareListRow } from "@/lib/share/share-list-contract";
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
  selectedTab: "output" | "history";
  showInput?: boolean;
};

const shareTabs = [
  { key: "output", label: "Output" },
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
  selectedTab,
  showInput,
}: ShareDetailPanelProps) {
  if (!latestGeneration || showInput) {
    return (
      <ShareInputForm
        action={action}
        platform={platform}
        prefillAngle={prefillAngle}
        prefillVariantCount={prefillVariantCount}
        product={product}
      />
    );
  }

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
              aria-current={selectedTab === tab.key ? "page" : undefined}
              className="tab-link"
              data-active={selectedTab === tab.key ? "true" : undefined}
              href={href}
              key={tab.key}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {selectedTab === "output" ? <ShareOutputTab generation={latestGeneration} /> : null}

      {selectedTab === "history" ? (
        <ShareHistoryTab generations={generations} platform={platform} productId={product.id} />
      ) : null}
    </div>
  );
}
