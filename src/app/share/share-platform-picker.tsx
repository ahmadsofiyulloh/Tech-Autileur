import Link from "next/link";
import {
  SHARE_PLATFORMS,
  SHARE_PLATFORM_LABELS,
  SHARE_PLATFORM_ICONS,
  type SharePlatform,
} from "@/lib/share/share-platform";

function PlatformCard({ platform }: { platform: SharePlatform }) {
  return (
    <Link className="share-platform-card" href={`/share/${platform}`} aria-label={`Buka ${SHARE_PLATFORM_LABELS[platform]}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={SHARE_PLATFORM_ICONS[platform]}
        alt=""
        aria-hidden="true"
        className="share-platform-card__icon"
      />
      <span className="share-platform-card__label">{SHARE_PLATFORM_LABELS[platform]}</span>
    </Link>
  );
}

export function SharePlatformPicker() {
  return (
    <section className="share-platform-picker" aria-label="Pilih platform share">
      <div className="share-platform-picker__header">
        <h2>Share</h2>
        <p>Pilih platform untuk generate caption.</p>
      </div>
      <div className="share-platform-picker__grid">
        {SHARE_PLATFORMS.map((platform) => (
          <PlatformCard key={platform} platform={platform} />
        ))}
      </div>
    </section>
  );
}
