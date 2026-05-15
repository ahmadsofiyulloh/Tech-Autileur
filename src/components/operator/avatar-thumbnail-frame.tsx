"use client";

import { Settings, User, UserRound } from "lucide-react";
import { MediaThumbnailFrame } from "@/components/operator/media-thumbnail-frame";

type AvatarThumbnailFallback = "settings" | "user" | "user-round";

type AvatarThumbnailFrameProps = {
  className: string;
  fallback?: AvatarThumbnailFallback;
  fallbackClassName?: string;
  iconSize?: number;
  src: string | null;
};

export function AvatarThumbnailFrame({
  className,
  fallback = "user-round",
  fallbackClassName,
  iconSize = 20,
  src,
}: AvatarThumbnailFrameProps) {
  const FallbackIcon = fallback === "settings" ? Settings : fallback === "user" ? User : UserRound;

  return (
    <MediaThumbnailFrame
      className={className}
      fallback={<FallbackIcon size={iconSize} aria-hidden="true" />}
      fallbackClassName={fallbackClassName}
      src={src}
    />
  );
}
