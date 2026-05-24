import Link from "next/link";
import {
  SHARE_PLATFORMS,
  SHARE_PLATFORM_LABELS,
  SHARE_PLATFORM_VISUALS,
  SHARE_PLATFORM_DESCRIPTIONS,
  type SharePlatform,
} from "@/lib/share/share-platform";

function SharePlatformCard({ platform }: { platform: SharePlatform }) {
  return (
    <Link href={`/share/${platform}`} className="ai-media-tool-card native-button" aria-label={`Buka ${SHARE_PLATFORM_LABELS[platform]}`}>
      <div className="ai-media-tool-card__visual">
        <img
          src={SHARE_PLATFORM_VISUALS[platform]}
          alt=""
          aria-hidden="true"
          className="ai-media-tool-card__image"
          loading="lazy"
        />
      </div>
      <div className="ai-media-tool-card__body">
        <strong className="ai-media-tool-card__title">{SHARE_PLATFORM_LABELS[platform]}</strong>
        <span className="ai-media-tool-card__label">{SHARE_PLATFORM_DESCRIPTIONS[platform]}</span>
      </div>
    </Link>
  );
}

export function SharePlatformGrid() {
  return (
    <div className="ai-media-lobby__grid share-platform-grid">
      {SHARE_PLATFORMS.map((platform) => (
        <SharePlatformCard key={platform} platform={platform} />
      ))}
    </div>
  );
}
