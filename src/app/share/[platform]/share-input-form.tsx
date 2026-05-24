"use client";

import { useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import { RelationalPicker, type RelationalPickerOption } from "@/components/operator/relational-picker";
import { ToggleField } from "@/components/operator/toggle-field";
import { NativeAnchorButton } from "@/components/ui/native-button";
import { PendingActionButton } from "@/components/operator/pending-action-button";
import {
  SHARE_ANGLES,
  SHARE_ANGLE_LABELS,
  SHARE_PLATFORM_LABELS,
  SHARE_VARIANT_COUNT_MAX,
  SHARE_VARIANT_COUNT_MIN,
  DEFAULT_SHARE_GENERATE_OPTIONS,
  type ShareAngle,
  type SharePlatform,
  type FacebookGenerateOptions,
  type ThreadsGenerateOptions,
  type XGenerateOptions,
  type PinterestGenerateOptions,
} from "@/lib/share/share-platform";
import type { ShareListRow } from "@/lib/share/share-list-contract";

type ShareInputFormProps = {
  action: (formData: FormData) => void;
  platform: SharePlatform;
  prefillAngle?: ShareAngle | null;
  prefillVariantCount?: number | null;
  product: ShareListRow;
};

export function ShareInputForm({ action, platform, prefillAngle, prefillVariantCount, product }: ShareInputFormProps) {
  const [affiliateUrl, setAffiliateUrl] = useState(product.affiliate_url ?? "");
  const [variantCount, setVariantCount] = useState(prefillVariantCount ?? 2);

  // Platform-specific options state
  const defaultOptions = DEFAULT_SHARE_GENERATE_OPTIONS[platform];
  const [fbPostMode, setFbPostMode] = useState<FacebookGenerateOptions["postMode"]>(
    (defaultOptions as FacebookGenerateOptions).postMode ?? "feed"
  );
  const [fbCaptionLength, setFbCaptionLength] = useState<FacebookGenerateOptions["captionLength"]>(
    (defaultOptions as FacebookGenerateOptions).captionLength ?? "medium"
  );
  const [fbIncludeFirstComment, setFbIncludeFirstComment] = useState(
    (defaultOptions as FacebookGenerateOptions).includeFirstComment ?? false
  );
  const [fbIncludeImagePrompt, setFbIncludeImagePrompt] = useState(
    (defaultOptions as FacebookGenerateOptions).includeImagePrompt ?? false
  );
  const [fbImageRatio, setFbImageRatio] = useState<FacebookGenerateOptions["imageRatio"]>(
    (defaultOptions as FacebookGenerateOptions).imageRatio ?? "4:5"
  );

  const [threadsMode, setThreadsMode] = useState<ThreadsGenerateOptions["mode"]>(
    (defaultOptions as ThreadsGenerateOptions).mode ?? "single"
  );
  const [threadsLinkPlacement, setThreadsLinkPlacement] = useState<ThreadsGenerateOptions["linkPlacement"]>(
    (defaultOptions as ThreadsGenerateOptions).linkPlacement ?? "in_caption"
  );
  const [threadsImagePlacement, setThreadsImagePlacement] = useState<ThreadsGenerateOptions["imagePlacement"]>(
    (defaultOptions as ThreadsGenerateOptions).imagePlacement ?? "with_post"
  );
  const [threadsImageRatio, setThreadsImageRatio] = useState<ThreadsGenerateOptions["imageRatio"]>(
    (defaultOptions as ThreadsGenerateOptions).imageRatio ?? "1:1"
  );

  const [xMode, setXMode] = useState<XGenerateOptions["mode"]>(
    (defaultOptions as XGenerateOptions).mode ?? "single_tweet"
  );
  const [xLengthMode, setXLengthMode] = useState<XGenerateOptions["lengthMode"]>(
    (defaultOptions as XGenerateOptions).lengthMode ?? "punchy"
  );
  const [xLinkPlacement, setXLinkPlacement] = useState<XGenerateOptions["linkPlacement"]>(
    (defaultOptions as XGenerateOptions).linkPlacement ?? "reply"
  );
  const [xIncludeImagePrompt, setXIncludeImagePrompt] = useState(
    (defaultOptions as XGenerateOptions).includeImagePrompt ?? false
  );
  const [xImageRatio, setXImageRatio] = useState<XGenerateOptions["imageRatio"]>(
    (defaultOptions as XGenerateOptions).imageRatio ?? "16:9"
  );

  const [pinterestPinType, setPinterestPinType] = useState<PinterestGenerateOptions["pinType"]>(
    (defaultOptions as PinterestGenerateOptions).pinType ?? "standard"
  );
  const [pinterestSeoKeywordMode, setPinterestSeoKeywordMode] = useState<PinterestGenerateOptions["seoKeywordMode"]>(
    (defaultOptions as PinterestGenerateOptions).seoKeywordMode ?? "auto"
  );
  const [pinterestSeoKeyword, setPinterestSeoKeyword] = useState(
    (defaultOptions as PinterestGenerateOptions).seoKeyword ?? ""
  );
  const [pinterestCtaStyle, setPinterestCtaStyle] = useState<PinterestGenerateOptions["ctaStyle"]>(
    (defaultOptions as PinterestGenerateOptions).ctaStyle ?? "soft"
  );
  const [pinterestImageRatio, setPinterestImageRatio] = useState<PinterestGenerateOptions["imageRatio"]>(
    (defaultOptions as PinterestGenerateOptions).imageRatio ?? "2:3"
  );
  const [pinterestGenerateAltText, setPinterestGenerateAltText] = useState(
    (defaultOptions as PinterestGenerateOptions).generateAltText ?? false
  );

  const canGenerate = affiliateUrl.trim().length > 0;
  const variantOptions = useMemo(
    () =>
      Array.from(
        { length: SHARE_VARIANT_COUNT_MAX - SHARE_VARIANT_COUNT_MIN + 1 },
        (_, index) => SHARE_VARIANT_COUNT_MIN + index,
      ),
    [],
  );
  const angleOptions = useMemo<RelationalPickerOption[]>(
    () =>
      SHARE_ANGLES.map((item) => ({
        value: item,
        label: SHARE_ANGLE_LABELS[item],
      })),
    [],
  );
  const initialAngle: ShareAngle = prefillAngle ?? "benefit_focused";

  // Build options arrays for RelationalPicker
  const fbPostModeOptions = useMemo<RelationalPickerOption[]>(
    () => [
      { value: "feed", label: "Feed" },
      { value: "story", label: "Story" },
      { value: "reel", label: "Reel" },
    ],
    [],
  );
  const fbCaptionLengthOptions = useMemo<RelationalPickerOption[]>(
    () => [
      { value: "short", label: "Pendek" },
      { value: "medium", label: "Sedang" },
      { value: "long", label: "Panjang" },
    ],
    [],
  );
  const fbImageRatioOptions = useMemo<RelationalPickerOption[]>(
    () => [
      { value: "1:1", label: "1:1" },
      { value: "4:5", label: "4:5" },
      { value: "16:9", label: "16:9" },
      { value: "9:16", label: "9:16" },
    ],
    [],
  );

  const threadsModeOptions = useMemo<RelationalPickerOption[]>(
    () => [
      { value: "single", label: "Single" },
      { value: "thread", label: "Thread" },
    ],
    [],
  );
  const threadsLinkPlacementOptions = useMemo<RelationalPickerOption[]>(
    () => [
      { value: "in_caption", label: "Di Caption" },
      { value: "first_reply", label: "Reply Pertama" },
      { value: "none", label: "Tanpa Link" },
    ],
    [],
  );
  const threadsImagePlacementOptions = useMemo<RelationalPickerOption[]>(
    () => [
      { value: "with_post", label: "Dengan Post" },
      { value: "none", label: "Tanpa Gambar" },
    ],
    [],
  );
  const threadsImageRatioOptions = useMemo<RelationalPickerOption[]>(
    () => [
      { value: "1:1", label: "1:1" },
      { value: "4:5", label: "4:5" },
      { value: "9:16", label: "9:16" },
    ],
    [],
  );

  const xModeOptions = useMemo<RelationalPickerOption[]>(
    () => [
      { value: "single_tweet", label: "Single Tweet" },
      { value: "thread", label: "Thread" },
    ],
    [],
  );
  const xLengthModeOptions = useMemo<RelationalPickerOption[]>(
    () => [
      { value: "punchy", label: "Punchy" },
      { value: "standard", label: "Standard" },
    ],
    [],
  );
  const xLinkPlacementOptions = useMemo<RelationalPickerOption[]>(
    () => [
      { value: "reply", label: "Reply" },
      { value: "none", label: "Tanpa Link" },
    ],
    [],
  );
  const xImageRatioOptions = useMemo<RelationalPickerOption[]>(
    () => [
      { value: "1:1", label: "1:1" },
      { value: "16:9", label: "16:9" },
    ],
    [],
  );

  const pinterestPinTypeOptions = useMemo<RelationalPickerOption[]>(
    () => [
      { value: "standard", label: "Standard" },
      { value: "idea", label: "Idea" },
    ],
    [],
  );
  const pinterestSeoKeywordModeOptions = useMemo<RelationalPickerOption[]>(
    () => [
      { value: "auto", label: "Auto" },
      { value: "manual", label: "Manual" },
    ],
    [],
  );
  const pinterestCtaStyleOptions = useMemo<RelationalPickerOption[]>(
    () => [
      { value: "soft", label: "Soft" },
      { value: "direct", label: "Direct" },
    ],
    [],
  );
  const pinterestImageRatioOptions = useMemo<RelationalPickerOption[]>(
    () => [
      { value: "2:3", label: "2:3" },
      { value: "1:1", label: "1:1" },
    ],
    [],
  );

  // Build the options payload for the active route platform.
  const optionsPayload = useMemo(() => {
    if (platform === "facebook") {
      const payload: FacebookGenerateOptions = {
        platform: "facebook",
        postMode: fbPostMode,
        captionLength: fbCaptionLength,
        includeFirstComment: fbIncludeFirstComment,
        includeImagePrompt: fbIncludeImagePrompt,
        imageRatio: fbImageRatio,
      };
      return payload;
    }
    if (platform === "threads") {
      const payload: ThreadsGenerateOptions = {
        platform: "threads",
        mode: threadsMode,
        linkPlacement: threadsLinkPlacement,
        imagePlacement: threadsImagePlacement,
        imageRatio: threadsImageRatio,
      };
      return payload;
    }
    if (platform === "x") {
      const payload: XGenerateOptions = {
        platform: "x",
        mode: xMode,
        lengthMode: xLengthMode,
        linkPlacement: xLinkPlacement,
        includeImagePrompt: xIncludeImagePrompt,
        imageRatio: xImageRatio,
      };
      return payload;
    }
    // pinterest — image prompt is locked ON per task spec
    const payload: PinterestGenerateOptions = {
      platform: "pinterest",
      pinType: pinterestPinType,
      seoKeywordMode: pinterestSeoKeywordMode,
      seoKeyword: pinterestSeoKeywordMode === "manual" ? pinterestSeoKeyword.trim() : "",
      ctaStyle: pinterestCtaStyle,
      includeImagePrompt: true,
      imageRatio: pinterestImageRatio,
      generateAltText: pinterestGenerateAltText,
    };
    return payload;
  }, [
    platform,
    fbPostMode,
    fbCaptionLength,
    fbIncludeFirstComment,
    fbIncludeImagePrompt,
    fbImageRatio,
    threadsMode,
    threadsLinkPlacement,
    threadsImagePlacement,
    threadsImageRatio,
    xMode,
    xLengthMode,
    xLinkPlacement,
    xIncludeImagePrompt,
    xImageRatio,
    pinterestPinType,
    pinterestSeoKeywordMode,
    pinterestSeoKeyword,
    pinterestCtaStyle,
    pinterestImageRatio,
    pinterestGenerateAltText,
  ]);
  const optionsJson = useMemo(() => JSON.stringify(optionsPayload), [optionsPayload]);

  return (
    <form action={action} className="share-input-form">
      <input type="hidden" name="product_id" value={product.id} />
      <input type="hidden" name="platform" value={platform} />
      <input type="hidden" name="variant_count" value={String(variantCount)} />
      <input type="hidden" name="options_json" value={optionsJson} />

      <div className="share-input-hero">
        {product.thumbnail_url ? (
          <img src={product.thumbnail_url} alt="" className="share-input-hero__image" />
        ) : (
          <div className="share-input-hero__image share-input-hero__image--empty" aria-hidden="true" />
        )}
        <div className="share-input-hero__content">
          <div className="share-input-hero__title-row">
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
          <p>{product.marketplace ?? "Marketplace belum ada"}</p>
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

        <RelationalPicker
          compact
          defaultValue={initialAngle}
          label="Angle"
          name="angle"
          options={angleOptions}
          searchable={false}
        />

        <fieldset className="share-input-field share-input-variant">
          <legend>Jumlah varian</legend>
          <div className="share-input-variant__options" role="radiogroup" aria-label="Jumlah varian">
            {variantOptions.map((item) => {
              const selected = variantCount === item;
              return (
                <button
                  key={item}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={`share-input-variant__btn${selected ? " is-selected" : ""}`}
                  onClick={() => setVariantCount(item)}
                >
                  <strong>{item}</strong>
                </button>
              );
            })}
          </div>
        </fieldset>
      </div>

      <fieldset className="share-input-options">
        <legend>Pengaturan {SHARE_PLATFORM_LABELS[platform]}</legend>

        {platform === "facebook" && (
          <div className="share-input-options__grid">
            <RelationalPicker
              compact
              searchable={false}
              label="Mode Post"
              name="fb_post_mode"
              defaultValue={fbPostMode}
              options={fbPostModeOptions}
              onChange={(v) => setFbPostMode(v as FacebookGenerateOptions["postMode"])}
            />
            <RelationalPicker
              compact
              searchable={false}
              label="Panjang Caption"
              name="fb_caption_length"
              defaultValue={fbCaptionLength}
              options={fbCaptionLengthOptions}
              onChange={(v) => setFbCaptionLength(v as FacebookGenerateOptions["captionLength"])}
            />
            <RelationalPicker
              compact
              searchable={false}
              label="Image Ratio"
              name="fb_image_ratio"
              defaultValue={fbImageRatio}
              options={fbImageRatioOptions}
              onChange={(v) => setFbImageRatio(v as FacebookGenerateOptions["imageRatio"])}
            />
            <ToggleField
              label="First Comment"
              name="fb_include_first_comment"
              defaultChecked={fbIncludeFirstComment}
              onChange={setFbIncludeFirstComment}
            />
            <ToggleField
              label="Image Prompt"
              name="fb_include_image_prompt"
              defaultChecked={fbIncludeImagePrompt}
              onChange={setFbIncludeImagePrompt}
            />
          </div>
        )}

        {platform === "threads" && (
          <div className="share-input-options__grid">
            <RelationalPicker
              compact
              searchable={false}
              label="Mode"
              name="threads_mode"
              defaultValue={threadsMode}
              options={threadsModeOptions}
              onChange={(v) => setThreadsMode(v as ThreadsGenerateOptions["mode"])}
            />
            <RelationalPicker
              compact
              searchable={false}
              label="Link Placement"
              name="threads_link_placement"
              defaultValue={threadsLinkPlacement}
              options={threadsLinkPlacementOptions}
              onChange={(v) => setThreadsLinkPlacement(v as ThreadsGenerateOptions["linkPlacement"])}
            />
            <RelationalPicker
              compact
              searchable={false}
              label="Image Placement"
              name="threads_image_placement"
              defaultValue={threadsImagePlacement}
              options={threadsImagePlacementOptions}
              onChange={(v) => setThreadsImagePlacement(v as ThreadsGenerateOptions["imagePlacement"])}
            />
            <RelationalPicker
              compact
              searchable={false}
              label="Image Ratio"
              name="threads_image_ratio"
              defaultValue={threadsImageRatio}
              options={threadsImageRatioOptions}
              onChange={(v) => setThreadsImageRatio(v as ThreadsGenerateOptions["imageRatio"])}
            />
          </div>
        )}

        {platform === "x" && (
          <div className="share-input-options__grid">
            <RelationalPicker
              compact
              searchable={false}
              label="Mode"
              name="x_mode"
              defaultValue={xMode}
              options={xModeOptions}
              onChange={(v) => setXMode(v as XGenerateOptions["mode"])}
            />
            <RelationalPicker
              compact
              searchable={false}
              label="Length Mode"
              name="x_length_mode"
              defaultValue={xLengthMode}
              options={xLengthModeOptions}
              onChange={(v) => setXLengthMode(v as XGenerateOptions["lengthMode"])}
            />
            <RelationalPicker
              compact
              searchable={false}
              label="Link Placement"
              name="x_link_placement"
              defaultValue={xLinkPlacement}
              options={xLinkPlacementOptions}
              onChange={(v) => setXLinkPlacement(v as XGenerateOptions["linkPlacement"])}
            />
            <RelationalPicker
              compact
              searchable={false}
              label="Image Ratio"
              name="x_image_ratio"
              defaultValue={xImageRatio}
              options={xImageRatioOptions}
              onChange={(v) => setXImageRatio(v as XGenerateOptions["imageRatio"])}
            />
            <ToggleField
              label="Image Prompt"
              name="x_include_image_prompt"
              defaultChecked={xIncludeImagePrompt}
              onChange={setXIncludeImagePrompt}
            />
          </div>
        )}

        {platform === "pinterest" && (
          <div className="share-input-options__grid">
            <RelationalPicker
              compact
              searchable={false}
              label="Pin Type"
              name="pinterest_pin_type"
              defaultValue={pinterestPinType}
              options={pinterestPinTypeOptions}
              onChange={(v) => setPinterestPinType(v as PinterestGenerateOptions["pinType"])}
            />
            <RelationalPicker
              compact
              searchable={false}
              label="SEO Keyword Mode"
              name="pinterest_seo_keyword_mode"
              defaultValue={pinterestSeoKeywordMode}
              options={pinterestSeoKeywordModeOptions}
              onChange={(v) => setPinterestSeoKeywordMode(v as PinterestGenerateOptions["seoKeywordMode"])}
            />
            {pinterestSeoKeywordMode === "manual" && (
              <label className="share-input-field">
                <span>SEO Keyword</span>
                <input
                  type="text"
                  value={pinterestSeoKeyword}
                  onChange={(e) => setPinterestSeoKeyword(e.target.value)}
                  placeholder="Keyword utama"
                  maxLength={100}
                />
              </label>
            )}
            <RelationalPicker
              compact
              searchable={false}
              label="CTA Style"
              name="pinterest_cta_style"
              defaultValue={pinterestCtaStyle}
              options={pinterestCtaStyleOptions}
              onChange={(v) => setPinterestCtaStyle(v as PinterestGenerateOptions["ctaStyle"])}
            />
            <RelationalPicker
              compact
              searchable={false}
              label="Image Ratio"
              name="pinterest_image_ratio"
              defaultValue={pinterestImageRatio}
              options={pinterestImageRatioOptions}
              onChange={(v) => setPinterestImageRatio(v as PinterestGenerateOptions["imageRatio"])}
            />
            <ToggleField
              label="Image Prompt (wajib)"
              name="pinterest_include_image_prompt"
              defaultChecked={true}
              disabled
            />
            <ToggleField
              label="Alt Text"
              name="pinterest_generate_alt_text"
              defaultChecked={pinterestGenerateAltText}
              onChange={setPinterestGenerateAltText}
            />
          </div>
        )}
      </fieldset>

      <div className="share-input-form__footer">
        <PendingActionButton className="primary" disabled={!canGenerate} pendingLabel="Generate...">
          Generate Caption
        </PendingActionButton>
      </div>
    </form>
  );
}
