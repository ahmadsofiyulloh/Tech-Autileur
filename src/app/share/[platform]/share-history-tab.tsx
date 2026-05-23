"use client";

import Link from "next/link";
import type { ShareGenerationRecord } from "@/lib/server/share-generations";
import { SHARE_ANGLE_LABELS, type SharePlatform } from "@/lib/share/share-platform";
import { buildShareListHref } from "@/lib/share/share-list-contract";

type ShareHistoryTabProps = {
  generations: ShareGenerationRecord[];
  platform: SharePlatform;
  productId: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function buildRegenerateHref(input: {
  platform: SharePlatform;
  productId: string;
  generationId: string;
}) {
  const base = buildShareListHref({
    platform: input.platform,
    detailId: input.productId,
  });
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}mode=input&from=${encodeURIComponent(input.generationId)}`;
}

export function ShareHistoryTab({ generations, platform, productId }: ShareHistoryTabProps) {
  if (!generations.length) {
    return (
      <div className="share-history-tab">
        <p className="helper-text">Belum ada riwayat generate.</p>
      </div>
    );
  }

  return (
    <div className="share-history-tab">
      <div className="share-history-table-head" aria-hidden="true">
        <span>Waktu</span>
        <span>Setting</span>
        <span>Preview</span>
        <span>Aksi</span>
      </div>
      <ul className="share-history-list">
        {generations.map((generation) => {
          const preview = generation.output_json?.[0]?.caption?.trim() ?? "Belum ada output.";
          const regenerateHref = buildRegenerateHref({
            platform,
            productId,
            generationId: generation.id,
          });

          return (
            <li key={generation.id} className="share-history-row">
              <div className="share-history-row__body">
                <div className="share-history-row__meta">{formatDate(generation.created_at)}</div>
                <div className="share-history-row__settings">
                  <strong>{SHARE_ANGLE_LABELS[generation.angle]}</strong>
                  <span>{generation.variant_count} varian</span>
                </div>
                <div className="share-history-row__preview">{preview}</div>
                <div className="share-history-row__actions">
                  <Link className="compact primary" href={regenerateHref}>
                    Regenerate
                  </Link>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
