"use client";

import { useEffect, useState, type ReactNode } from "react";

type MediaThumbnailFrameProps = {
  alt?: string;
  className?: string;
  fallback: ReactNode;
  fallbackClassName?: string;
  loading?: "eager" | "lazy";
  src: string | null;
};

export function MediaThumbnailFrame({
  alt = "",
  className,
  fallback,
  fallbackClassName,
  loading = "lazy",
  src,
}: MediaThumbnailFrameProps) {
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [src]);

  const showImage = Boolean(src) && !imageError;
  const frameClassName = [className, !showImage ? fallbackClassName : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className={frameClassName} aria-hidden="true">
      {showImage ? (
        <img
          alt={alt}
          decoding="async"
          loading={loading}
          src={src ?? undefined}
          onError={() => setImageError(true)}
        />
      ) : (
        fallback
      )}
    </div>
  );
}
