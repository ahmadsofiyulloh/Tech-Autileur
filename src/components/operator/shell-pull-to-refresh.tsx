"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
  type RefObject,
  type TouchEvent as ReactTouchEvent,
} from "react";
import { ArrowDownToLine, RefreshCcw } from "lucide-react";

type PullToRefreshState = "idle" | "pulling" | "armed" | "refreshing";

type PullToRefreshProps = {
  scrollContainerRef: RefObject<HTMLElement | null>;
};

const PULL_START_ZONE_PX = 28;
const PULL_ACTIVATION_DISTANCE_PX = 72;
const PULL_PANEL_HEIGHT_PX = 34;
const PULL_VISUAL_MAX_DISTANCE_PX = 104;
const PULL_VISUAL_MULTIPLIER = 0.8;
const DISMISS_SWIPE_THRESHOLD_PX = 24;
const REFRESH_SETTLE_DELAY_MS = 180;
const REFRESH_FALLBACK_TIMEOUT_MS = 8000;

function isInteractiveTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return false;
  }

  return Boolean(
    target.closest(
      "input, textarea, select, option, button, a, summary, [role='button'], [role='tab'], [contenteditable='true'], .shell-pull-to-refresh",
    ),
  );
}

export function ShellPullToRefresh({ scrollContainerRef }: PullToRefreshProps) {
  const router = useRouter();
  const [state, setState] = useState<PullToRefreshState>("idle");
  const [dragDistance, setDragDistance] = useState(0);
  const [isPending, startTransition] = useTransition();
  const stateRef = useRef<PullToRefreshState>("idle");
  const pullGestureRef = useRef<{ x: number; y: number } | null>(null);
  const dismissGestureRef = useRef<{ x: number; y: number } | null>(null);
  const fallbackTimerRef = useRef<number | null>(null);

  const updateState = useCallback((nextState: PullToRefreshState) => {
    stateRef.current = nextState;
    setState(nextState);
  }, []);

  const clearFallbackTimer = useCallback(() => {
    if (fallbackTimerRef.current !== null) {
      window.clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  }, []);

  const resetIndicator = useCallback(() => {
    clearFallbackTimer();
    pullGestureRef.current = null;
    dismissGestureRef.current = null;
    setDragDistance(0);
    updateState("idle");
  }, [clearFallbackTimer, updateState]);

  const triggerRefresh = useCallback(() => {
    if (stateRef.current === "refreshing") {
      return;
    }

    clearFallbackTimer();
    pullGestureRef.current = null;
    dismissGestureRef.current = null;
    setDragDistance(PULL_PANEL_HEIGHT_PX);
    updateState("refreshing");

    startTransition(() => {
      router.refresh();
    });
  }, [clearFallbackTimer, router, startTransition, updateState]);

  useEffect(() => {
    const container = scrollContainerRef.current;

    if (!container) {
      return undefined;
    }

    const shellMain = container;

    function handleTouchStart(event: TouchEvent) {
      if (event.touches.length !== 1 || stateRef.current === "refreshing") {
        pullGestureRef.current = null;
        return;
      }

      if (isInteractiveTarget(event.target) || shellMain.scrollTop > 0) {
        pullGestureRef.current = null;
        return;
      }

      const touch = event.touches[0];
      const containerRect = shellMain.getBoundingClientRect();
      const startOffsetY = touch.clientY - containerRect.top;

      if (startOffsetY > PULL_START_ZONE_PX) {
        pullGestureRef.current = null;
        return;
      }

      pullGestureRef.current = {
        x: touch.clientX,
        y: touch.clientY,
      };
    }

    function handleTouchMove(event: TouchEvent) {
      const gesture = pullGestureRef.current;

      if (!gesture || event.touches.length !== 1 || stateRef.current === "refreshing") {
        return;
      }

      if (shellMain.scrollTop > 0) {
        resetIndicator();
        return;
      }

      const touch = event.touches[0];
      const deltaX = Math.abs(touch.clientX - gesture.x);
      const deltaY = touch.clientY - gesture.y;

      if (deltaY <= 0) {
        resetIndicator();
        return;
      }

      if (deltaX > Math.max(12, deltaY * 1.2)) {
        resetIndicator();
        return;
      }

      if (event.cancelable) {
        event.preventDefault();
      }

      const visualDistance = Math.min(PULL_VISUAL_MAX_DISTANCE_PX, deltaY * PULL_VISUAL_MULTIPLIER);
      setDragDistance(visualDistance);

      if (deltaY >= PULL_ACTIVATION_DISTANCE_PX) {
        updateState("armed");
        return;
      }

      updateState("pulling");
    }

    function handleTouchEnd() {
      if (stateRef.current === "armed") {
        triggerRefresh();
        return;
      }

      resetIndicator();
    }

    shellMain.addEventListener("touchstart", handleTouchStart, { passive: true });
    shellMain.addEventListener("touchmove", handleTouchMove, { passive: false });
    shellMain.addEventListener("touchend", handleTouchEnd);
    shellMain.addEventListener("touchcancel", handleTouchEnd);

    return () => {
      shellMain.removeEventListener("touchstart", handleTouchStart);
      shellMain.removeEventListener("touchmove", handleTouchMove);
      shellMain.removeEventListener("touchend", handleTouchEnd);
      shellMain.removeEventListener("touchcancel", handleTouchEnd);
      clearFallbackTimer();
    };
  }, [clearFallbackTimer, resetIndicator, scrollContainerRef, triggerRefresh, updateState]);

  useEffect(() => {
    if (state !== "refreshing") {
      clearFallbackTimer();
      return undefined;
    }

    fallbackTimerRef.current = window.setTimeout(() => {
      resetIndicator();
    }, REFRESH_FALLBACK_TIMEOUT_MS);

    return () => {
      clearFallbackTimer();
    };
  }, [clearFallbackTimer, resetIndicator, state]);

  useEffect(() => {
    if (state !== "refreshing" || isPending) {
      return undefined;
    }

    const settleTimer = window.setTimeout(() => {
      resetIndicator();
    }, REFRESH_SETTLE_DELAY_MS);

    return () => {
      window.clearTimeout(settleTimer);
    };
  }, [isPending, resetIndicator, state]);

  const dismissSwipeStart = useCallback((event: ReactTouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 1) {
      dismissGestureRef.current = null;
      return;
    }

    const touch = event.touches[0];
    dismissGestureRef.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const dismissSwipeMove = useCallback(
    (event: ReactTouchEvent<HTMLDivElement>) => {
      const gesture = dismissGestureRef.current;

      if (!gesture || stateRef.current === "idle") {
        return;
      }

      const touch = event.touches[0];
      if (!touch) {
        return;
      }

      const deltaX = Math.abs(touch.clientX - gesture.x);
      const deltaY = touch.clientY - gesture.y;

      if (Math.abs(deltaY) >= DISMISS_SWIPE_THRESHOLD_PX && Math.abs(deltaY) > Math.abs(deltaX) * 1.15) {
        if (event.cancelable) {
          event.preventDefault();
        }

        resetIndicator();
      }
    },
    [resetIndicator],
  );

  const dismissSwipeEnd = useCallback(() => {
    dismissGestureRef.current = null;
  }, []);

  if (state === "idle") {
    return null;
  }

  const label = state === "refreshing" ? "Muat ulang..." : state === "armed" ? "Lepas untuk muat ulang" : "Tarik untuk muat ulang";
  const hint =
    state === "refreshing" ? "Mengambil data terbaru" : state === "armed" ? "Lepaskan di atas untuk mulai" : "Geser dari tepi atas";
  const icon = state === "refreshing" ? (
    <RefreshCcw className="shell-pull-to-refresh__icon shell-pull-to-refresh__icon--spinning" aria-hidden="true" size={16} />
  ) : (
    <ArrowDownToLine className="shell-pull-to-refresh__icon" aria-hidden="true" size={16} />
  );
  const progress = state === "refreshing" ? 100 : Math.max(0, Math.min(100, Math.round((dragDistance / PULL_ACTIVATION_DISTANCE_PX) * 100)));

  return (
    <section
      className="shell-pull-to-refresh"
      aria-atomic="true"
      aria-live="polite"
      role="status"
      data-state={state}
      onTouchStart={dismissSwipeStart}
      onTouchMove={dismissSwipeMove}
      onTouchEnd={dismissSwipeEnd}
      onTouchCancel={dismissSwipeEnd}
      style={
        {
          "--shell-pull-to-refresh-progress": `${progress}%`,
        } as CSSProperties
      }
    >
      <div className="shell-pull-to-refresh__line">
        <button
          className="shell-pull-to-refresh__button"
          data-state={state}
          type="button"
          onClick={triggerRefresh}
          disabled={state === "refreshing" || isPending}
          aria-label={label}
        >
          <span className="shell-pull-to-refresh__icon-wrap" aria-hidden="true">
            {icon}
          </span>
          <span className="shell-pull-to-refresh__copy" aria-hidden="true">
            <strong className="shell-pull-to-refresh__label">{label}</strong>
            <span className="shell-pull-to-refresh__hint">{hint}</span>
          </span>
        </button>
      </div>
      <div className="shell-pull-to-refresh__meter" aria-hidden="true">
        <span />
      </div>
    </section>
  );
}
