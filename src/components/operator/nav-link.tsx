"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, type ComponentProps } from "react";

const HOVER_PREFETCH_DEBOUNCE_MS = 150;

type NavLinkProps = Omit<ComponentProps<typeof Link>, "prefetch"> & {
  /**
   * When true, fall back to default Next.js Link prefetch behavior.
   * Defaults to false: visibility-based prefetch is disabled, hover triggers
   * a debounced router.prefetch instead. Use only for primary operator nav
   * destinations to avoid the prefetch storm observed in benchmarks.
   */
  forceVisibilityPrefetch?: boolean;
};

export function NavLink({
  forceVisibilityPrefetch = false,
  href,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onTouchStart,
  ...rest
}: NavLinkProps) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startPrefetch = useCallback(() => {
    if (typeof href !== "string") return;
    const target = href;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      try {
        router.prefetch(target);
      } catch {
        // router.prefetch is best-effort; ignore failures.
      }
    }, HOVER_PREFETCH_DEBOUNCE_MS);
  }, [href, router]);

  const immediatePrefetch = useCallback(() => {
    if (typeof href !== "string") return;
    try {
      router.prefetch(href);
    } catch {
      // best-effort
    }
  }, [href, router]);

  const cancelPrefetch = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return (
    <Link
      {...rest}
      href={href}
      prefetch={forceVisibilityPrefetch ? undefined : false}
      onMouseEnter={(event) => {
        startPrefetch();
        onMouseEnter?.(event);
      }}
      onFocus={(event) => {
        startPrefetch();
        onFocus?.(event);
      }}
      onMouseLeave={(event) => {
        cancelPrefetch();
        onMouseLeave?.(event);
      }}
      onTouchStart={(event) => {
        immediatePrefetch();
        onTouchStart?.(event);
      }}
    />
  );
}
