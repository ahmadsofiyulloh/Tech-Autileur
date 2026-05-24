"use client";

import { useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import { RelationalPicker, type RelationalPickerOption } from "@/components/operator/relational-picker";
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
            <label className="share-input-field">
              <span>Mode Post</span>
              <select value={fbPostMode} onChange={(e) => setFbPostMode(e.target.value as FacebookGenerateOptions["postMode"])}>
                <option value="feed">Feed</option>
                <option value="story">Story</option>
                <option value="reel">Reel</option>
              </select>
            </label>
            <label className="share-input-field">
              <span>Panjang Caption</span>
              <select value={fbCaptionLength} onChange={(e) => setFbCaptionLength(e.target.value as FacebookGenerateOptions["captionLength"])}>
                <option value="short">Pendek</option>
                <option value="medium">Sedang</option>
                <option value="long">Panjang</option>
              </select>
            </label>
            <label className="share-input-field">
              <span>Image Ratio</span>
              <select value={fbImageRatio} onChange={(e) => setFbImageRatio(e.target.value as FacebookGenerateOptions["imageRatio"])}>
                <option value="1:1">1:1</option>
                <option value="4:5">4:5</option>
                <option value="16:9">16:9</option>
                <option value="9:16">9:16</option>
              </select>
            </label>
            <label className="share-input-field share-input-field--checkbox">
              <input type="checkbox" checked={fbIncludeFirstComment} onChange={(e) => setFbIncludeFirstComment(e.target.checked)} />
              <span>First Comment</span>
            </label>
            <label className="share-input-field share-input-field--checkbox">
              <input type="checkbox" checked={fbIncludeImagePrompt} onChange={(e) => setFbIncludeImagePrompt(e.target.checked)} />
              <span>Image Prompt</span>
            </label>
          </div>
        )}

        {platform === "threads" && (
          <div className="share-input-options__grid">
            <label className="share-input-field">
              <span>Mode</span>
              <select value={threadsMode} onChange={(e) => setThreadsMode(e.target.value as ThreadsGenerateOptions["mode"])}>
                <option value="single">Single</option>
                <option value="thread">Thread</option>
              </select>
            </label>
            <label className="share-input-field">
              <span>Link Placement</span>
              <select value={threadsLinkPlacement} onChange={(e) => setThreadsLinkPlacement(e.target.value as ThreadsGenerateOptions["linkPlacement"])}>
                <option value="in_caption">Di Caption</option>
                <option value="first_reply">Reply Pertama</option>
                <option value="none">Tanpa Link</option>
              </select>
            </label>
            <label className="share-input-field">
              <span>Image Placement</span>
              <select value={threadsImagePlacement} onChange={(e) => setThreadsImagePlacement(e.target.value as ThreadsGenerateOptions["imagePlacement"])}>
                <option value="with_post">Dengan Post</option>
                <option value="none">Tanpa Gambar</option>
              </select>
            </label>
            <label className="share-input-field">
              <span>Image Ratio</span>
              <select value={threadsImageRatio} onChange={(e) => setThreadsImageRatio(e.target.value as ThreadsGenerateOptions["imageRatio"])}>
                <option value="1:1">1:1</option>
                <option value="4:5">4:5</option>
                <option value="9:16">9:16</option>
              </select>
            </label>
          </div>
        )}

        {platform === "x" && (
          <div className="share-input-options__grid">
            <label className="share-input-field">
              <span>Mode</span>
              <select value={xMode} onChange={(e) => setXMode(e.target.value as XGenerateOptions["mode"])}>
                <option value="single_tweet">Single Tweet</option>
                <option value="thread">Thread</option>
              </select>
            </label>
            <label className="share-input-field">
              <span>Length Mode</span>
              <select value={xLengthMode} onChange={(e) => setXLengthMode(e.target.value as XGenerateOptions["lengthMode"])}>
                <option value="punchy">Punchy</option>
                <option value="standard">Standard</option>
              </select>
            </label>
            <label className="share-input-field">
              <span>Link Placement</span>
              <select value={xLinkPlacement} onChange={(e) => setXLinkPlacement(e.target.value as XGenerateOptions["linkPlacement"])}>
                <option value="reply">Reply</option>
                <option value="none">Tanpa Link</option>
              </select>
            </label>
            <label className="share-input-field">
              <span>Image Ratio</span>
              <select value={xImageRatio} onChange={(e) => setXImageRatio(e.target.value as XGenerateOptions["imageRatio"])}>
                <option value="1:1">1:1</option>
                <option value="16:9">16:9</option>
              </select>
            </label>
            <label className="share-input-field share-input-field--checkbox">
              <input type="checkbox" checked={xIncludeImagePrompt} onChange={(e) => setXIncludeImagePrompt(e.target.checked)} />
              <span>Image Prompt</span>
            </label>
          </div>
        )}

        {platform === "pinterest" && (
          <div className="share-input-options__grid">
            <label className="share-input-field">
              <span>Pin Type</span>
              <select value={pinterestPinType} onChange={(e) => setPinterestPinType(e.target.value as PinterestGenerateOptions["pinType"])}>
                <option value="standard">Standard</option>
                <option value="idea">Idea</option>
              </select>
            </label>
            <label className="share-input-field">
              <span>SEO Keyword Mode</span>
              <select value={pinterestSeoKeywordMode} onChange={(e) => setPinterestSeoKeywordMode(e.target.value as PinterestGenerateOptions["seoKeywordMode"])}>
                <option value="auto">Auto</option>
                <option value="manual">Manual</option>
              </select>
            </label>
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
            <label className="share-input-field">
              <span>CTA Style</span>
              <select value={pinterestCtaStyle} onChange={(e) => setPinterestCtaStyle(e.target.value as PinterestGenerateOptions["ctaStyle"])}>
                <option value="soft">Soft</option>
                <option value="direct">Direct</option>
              </select>
            </label>
            <label className="share-input-field">
              <span>Image Ratio</span>
              <select value={pinterestImageRatio} onChange={(e) => setPinterestImageRatio(e.target.value as PinterestGenerateOptions["imageRatio"])}>
                <option value="2:3">2:3</option>
                <option value="1:1">1:1</option>
              </select>
            </label>
            <label className="share-input-field share-input-field--checkbox">
              <input type="checkbox" checked disabled aria-label="Image Prompt (wajib)" />
              <span>Image Prompt <small>(wajib)</small></span>
            </label>
            <label className="share-input-field share-input-field--checkbox">
              <input type="checkbox" checked={pinterestGenerateAltText} onChange={(e) => setPinterestGenerateAltText(e.target.checked)} />
              <span>Alt Text</span>
            </label>
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
