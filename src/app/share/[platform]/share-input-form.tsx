"use client";

import { useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import { StatusBadge } from "@/components/operator/status-badge";
import { NativeAnchorButton } from "@/components/ui/native-button";
import { PendingActionButton } from "@/components/operator/pending-action-button";
import {
  SHARE_ANGLES,
  SHARE_ANGLE_LABELS,
  SHARE_PLATFORM_LABELS,
  SHARE_VARIANT_COUNT_MAX,
  SHARE_VARIANT_COUNT_MIN,
  type ShareAngle,
  type SharePlatform,
} from "@/lib/share/share-platform";
import type { ShareListRow } from "@/lib/share/share-list-contract";

type ShareInputFormProps = {
  action: (formData: FormData) => void;
  platform: SharePlatform;
  prefillAngle?: ShareAngle | null;
  prefillVariantCount?: number | null;
  product: ShareListRow;
};

function getStatusLabel(status: ShareListRow["share_status"]) {
  switch (status) {
    case "needs_link":
      return "Perlu Link Affiliate";
    case "ready":
      return "Siap Generate";
    case "generated":
      return "Selesai";
    case "error":
      return "Error";
    default:
      return status;
  }
}

function getStatusTone(status: ShareListRow["share_status"]) {
  switch (status) {
    case "needs_link":
      return "warning" as const;
    case "generated":
      return "success" as const;
    case "error":
      return "danger" as const;
    default:
      return "neutral" as const;
  }
}

export function ShareInputForm({ action, platform, prefillAngle, prefillVariantCount, product }: ShareInputFormProps) {
  const [affiliateUrl, setAffiliateUrl] = useState(product.affiliate_url ?? "");
  const [angle, setAngle] = useState<ShareAngle>(prefillAngle ?? "benefit_focused");
  const [variantCount, setVariantCount] = useState(String(prefillVariantCount ?? 2));
  const canGenerate = affiliateUrl.trim().length > 0;
  const variantOptions = useMemo(
    () =>
      Array.from(
        { length: SHARE_VARIANT_COUNT_MAX - SHARE_VARIANT_COUNT_MIN + 1 },
        (_, index) => SHARE_VARIANT_COUNT_MIN + index,
      ),
    [],
  );

  return (
    <form action={action} className="share-input-form">
      <input type="hidden" name="product_id" value={product.id} />
      <input type="hidden" name="platform" value={platform} />

      <div className="share-input-hero">
        {product.thumbnail_url ? (
          <img src={product.thumbnail_url} alt="" className="share-input-hero__image" />
        ) : (
          <div className="share-input-hero__image share-input-hero__image--empty" aria-hidden="true" />
        )}
        <div className="share-input-hero__content">
          <div className="share-input-hero__title-row">
            <h2>{product.product_name}</h2>
            <StatusBadge status={getStatusLabel(product.share_status)} tone={getStatusTone(product.share_status)} />
          </div>
          <p>{product.marketplace ?? "Marketplace belum ada"}</p>
          <div className="share-input-hero__actions">
            {product.product_url ? (
              <NativeAnchorButton
                className="compact tertiary"
                href={product.product_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink size={14} aria-hidden="true" />
                Buka Produk
              </NativeAnchorButton>
            ) : null}
          </div>
        </div>
      </div>

      <div className="share-input-grid">
        <label className="share-input-field share-input-field--wide">
          <span>Affiliate URL</span>
          <input
            name="affiliate_url"
            type="url"
            value={affiliateUrl}
            onChange={(event) => setAffiliateUrl(event.target.value)}
            placeholder="Tempel link affiliate produk"
            required
          />
          {!canGenerate ? <small>Affiliate URL wajib diisi sebelum generate.</small> : null}
        </label>

        <label className="share-input-field">
          <span>Platform</span>
          <input value={SHARE_PLATFORM_LABELS[platform]} readOnly aria-readonly="true" />
        </label>

        <label className="share-input-field">
          <span>Angle</span>
          <select name="angle" value={angle} onChange={(event) => setAngle(event.target.value as ShareAngle)}>
            {SHARE_ANGLES.map((item) => (
              <option key={item} value={item}>
                {SHARE_ANGLE_LABELS[item]}
              </option>
            ))}
          </select>
        </label>

        <label className="share-input-field">
          <span>Jumlah varian</span>
          <select name="variant_count" value={variantCount} onChange={(event) => setVariantCount(event.target.value)}>
            {variantOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="share-input-form__footer">
        <PendingActionButton className="primary" disabled={!canGenerate} pendingLabel="Generate...">
          Generate Caption
        </PendingActionButton>
      </div>
    </form>
  );
}
