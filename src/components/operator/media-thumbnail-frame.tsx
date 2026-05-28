"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type MediaThumbnailFrameProps = {
  alt?: string;
  className?: string;
  fallback: ReactNode;
  fallbackClassName?: string;
  deferUntilVisible?: boolean;
  loading?: "eager" | "lazy";
  src: string | null;
};

export function MediaThumbnailFrame({
  alt = "",
  className,
  fallback,
  fallbackClassName,
  deferUntilVisible = false,
  loading = "lazy",
  src,
}: MediaThumbnailFrameProps) {
  const [imageError, setImageError] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(() => !deferUntilVisible);
  const frameRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!deferUntilVisible) {
      return;
    }

    const frame = frameRef.current;

    if (!frame) {
      return;
    }

    if (typeof window === "undefined" || !("IntersectionObserver" in window)) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: "128px 0px",
      },
    );

    observer.observe(frame);

    return () => observer.disconnect();
  }, [deferUntilVisible, src]);

  const showImage = Boolean(src) && imageError !== src && (!deferUntilVisible || isVisible);
  const frameClassName = [className, !showImage ? fallbackClassName : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className={frameClassName} aria-hidden="true" ref={frameRef}>
      {showImage ? (
        <img
          alt={alt}
          decoding="async"
          loading={loading}
          src={src ?? undefined}
          onError={() => setImageError(src)}
        />
      ) : (
        fallback
      )}
    </div>
  );
}
