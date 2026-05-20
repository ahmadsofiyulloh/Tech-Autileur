"use client";

import {
  AlertTriangle,
  Bell,
  ChevronRight,
  CheckCircle2,
  CloudOff,
  LogOut,
  Settings,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { createPortal } from "react-dom";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { AvatarThumbnailFrame } from "@/components/operator/avatar-thumbnail-frame";
import type { OperatorShellAffiliateProfile } from "@/components/operator/operator-shell-context";
import { ThemeToggle } from "@/components/operator/theme-toggle";
import {
  readJsonApiErrorMessage,
  unwrapJsonApiData,
  type JsonApiResponse,
} from "@/lib/api-response-contract";
import type { ActivityFeedItem, ActivityFeedTone, OperatorActivityFeedResponse } from "@/lib/operator-activity-feed-contract";
import type { ThemePreference } from "@/lib/theme-preference";
import { cn } from "@/lib/utils";

type PanelKind = "activity" | "profile";
type ActivityPanelState = "loading" | "ready" | "empty" | "error";

type TopbarGlobalControlsProps = {
  currentAffiliateProfile: OperatorShellAffiliateProfile | null;
  hideSettingsAction?: boolean;
  themePreference: ThemePreference;
};

type PanelPosition = {
  left: number;
  top: number;
};

const activityRelativeTimeFormatter = new Intl.RelativeTimeFormat("id-ID", { numeric: "auto" });

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function useMobileShellQuery() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 860px)");
    const update = () => setIsMobile(mediaQuery.matches);

    update();
    mediaQuery.addEventListener("change", update);

    return () => {
      mediaQuery.removeEventListener("change", update);
    };
  }, []);

  return isMobile;
}

function getActivityIcon(tone: ActivityFeedTone): LucideIcon {
  if (tone === "error") {
    return AlertTriangle;
  }

  if (tone === "warning") {
    return CloudOff;
  }

  if (tone === "success") {
    return CheckCircle2;
  }

  return Bell;
}

function hasNotificationDot(items: ActivityFeedItem[]) {
  return items.some((item) => item.tone === "error" || item.tone === "warning");
}

function formatActivityTime(value: string) {
  const occurredAt = new Date(value);
  const timestamp = occurredAt.getTime();

  if (!Number.isFinite(timestamp)) {
    return "-";
  }

  const diffSeconds = Math.round((timestamp - Date.now()) / 1000);
  const absoluteSeconds = Math.abs(diffSeconds);

  if (absoluteSeconds < 45) {
    return "baru saja";
  }

  if (absoluteSeconds < 3600) {
    return activityRelativeTimeFormatter.format(Math.round(diffSeconds / 60), "minute");
  }

  if (absoluteSeconds < 86_400) {
    return activityRelativeTimeFormatter.format(Math.round(diffSeconds / 3600), "hour");
  }

  return activityRelativeTimeFormatter.format(Math.round(diffSeconds / 86_400), "day");
}

async function fetchActivityFeed(signal: AbortSignal) {
  const response = await fetch("/api/operator/activity-feed?limit=12", {
    cache: "no-store",
    signal,
  });
  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    throw new Error(readJsonApiErrorMessage(payload, "Tidak dapat memuat aktivitas."));
  }

  const data = unwrapJsonApiData<OperatorActivityFeedResponse>(
    payload as OperatorActivityFeedResponse | JsonApiResponse<OperatorActivityFeedResponse>,
  );

  return {
    ...data,
    items: Array.isArray(data.items) ? data.items : [],
  };
}

function PanelHeader({
  onClose,
  subtitle,
  title,
}: {
  onClose: () => void;
  subtitle?: ReactNode;
  title: ReactNode;
}) {
  return (
    <div className="topbar-panel__header">
      <div className="topbar-panel__title">
        <strong>{title}</strong>
        {subtitle ? <span>{subtitle}</span> : null}
      </div>
      <button className="topbar-panel__close" type="button" aria-label="Tutup panel" onClick={onClose}>
        <X size={15} aria-hidden="true" />
      </button>
    </div>
  );
}

function ProfileMenuContent({
  currentAffiliateProfile,
  hideSettingsAction,
  onClose,
  themePreference,
}: {
  currentAffiliateProfile: OperatorShellAffiliateProfile | null;
  hideSettingsAction: boolean;
  onClose: () => void;
  themePreference: ThemePreference;
}) {
  const profileName = currentAffiliateProfile?.profileName?.trim() || "Operator";

  return (
    <div className="topbar-profile-menu">
      <div className="topbar-profile-overview">
        <AvatarThumbnailFrame
          className="topbar-profile-overview__avatar"
          fallback="user-round"
          fallbackClassName="topbar-profile-link__avatar--fallback"
          iconSize={18}
          src={currentAffiliateProfile?.avatarUrl ?? null}
        />
        <span className="topbar-profile-overview__copy">
          <strong>{profileName}</strong>
          <span>Akun aktif</span>
        </span>
        <Link className="topbar-profile-overview__switch" href="/settings" onClick={onClose}>
          Ganti Akun
        </Link>
      </div>

      <div className="topbar-menu-theme-row">
        <ThemeToggle className="theme-mode-toggle--compact" initialTheme={themePreference} label="Tema" />
      </div>

      <div className="topbar-menu-list">
        {hideSettingsAction ? null : (
          <Link className="topbar-menu-item" href="/settings" onClick={onClose}>
            <Settings size={16} aria-hidden="true" />
            <span>Pengaturan</span>
            <ChevronRight className="topbar-menu-item__chevron" size={15} aria-hidden="true" />
          </Link>
        )}
        <form action="/auth/signout" className="topbar-menu-form" method="post">
          <button className="topbar-menu-item topbar-menu-item--danger" type="submit">
            <LogOut size={16} aria-hidden="true" />
            <span>Log out</span>
          </button>
        </form>
      </div>
    </div>
  );
}

function ActivityStateView({ state }: { state: Exclude<ActivityPanelState, "ready"> }) {
  if (state === "loading") {
    return (
      <div className="topbar-panel-state" data-state="loading">
        <span className="topbar-panel-state__skeleton" aria-hidden="true" />
        <span>Memuat aktivitas.</span>
      </div>
    );
  }

  if (state === "empty") {
    return (
      <div className="topbar-panel-state" data-state="empty">
        <Bell size={18} aria-hidden="true" />
        <span>Belum ada aktivitas.</span>
      </div>
    );
  }

  return (
    <div className="topbar-panel-state" data-state="error">
      <AlertTriangle size={18} aria-hidden="true" />
      <span>Tidak dapat memuat aktivitas.</span>
    </div>
  );
}

function ActivityPanelContent({
  items,
  onNavigate,
  state,
}: {
  items: ActivityFeedItem[];
  onNavigate: () => void;
  state: ActivityPanelState;
}) {
  if (state !== "ready") {
    return <ActivityStateView state={state} />;
  }

  return (
    <div className="topbar-activity-list">
      {items.map((item) => {
        const Icon = getActivityIcon(item.tone);
        const content = (
          <>
            <span className="topbar-activity-item__icon" aria-hidden="true">
              <Icon size={16} />
            </span>
            <span className="topbar-activity-item__copy">
              <span className="topbar-activity-item__meta">
                <span>{item.category}</span>
                <time dateTime={item.occurredAt}>{formatActivityTime(item.occurredAt)}</time>
              </span>
              <strong>{item.title}</strong>
              <span>{item.message}</span>
            </span>
          </>
        );

        if (item.href) {
          return (
            <Link className="topbar-activity-item" data-tone={item.tone} href={item.href} key={item.id} onClick={onNavigate}>
              {content}
            </Link>
          );
        }

        return (
          <article className="topbar-activity-item" data-tone={item.tone} key={item.id}>
            {content}
          </article>
        );
      })}
    </div>
  );
}

export function TopbarGlobalControls({
  currentAffiliateProfile,
  hideSettingsAction = false,
  themePreference,
}: TopbarGlobalControlsProps) {
  const [openPanel, setOpenPanel] = useState<PanelKind | null>(null);
  const [position, setPosition] = useState<PanelPosition | null>(null);
  const [activityItems, setActivityItems] = useState<ActivityFeedItem[]>([]);
  const [activityState, setActivityState] = useState<ActivityPanelState>("empty");
  const activityButtonRef = useRef<HTMLButtonElement | null>(null);
  const profileButtonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const profilePanelId = useId();
  const activityPanelId = useId();
  const isMobile = useMobileShellQuery();

  useEffect(() => {
    if (openPanel !== "activity" || activityState !== "loading") {
      return;
    }

    const controller = new AbortController();

    async function loadActivity() {
      try {
        const feed = await fetchActivityFeed(controller.signal);

        if (controller.signal.aborted) {
          return;
        }

        setActivityItems(feed.items);
        setActivityState(feed.items.length ? "ready" : "empty");
      } catch {
        if (!controller.signal.aborted) {
          setActivityState("error");
        }
      }
    }

    void loadActivity();

    return () => {
      controller.abort();
    };
  }, [activityState, openPanel]);

  useLayoutEffect(() => {
    if (!openPanel || isMobile || !panelRef.current) {
      setPosition(null);
      return;
    }

    const trigger = openPanel === "activity" ? activityButtonRef.current : profileButtonRef.current;

    if (!trigger) {
      return;
    }

    const viewportPadding = 8;
    const triggerRect = trigger.getBoundingClientRect();
    const panelRect = panelRef.current.getBoundingClientRect();
    const left = clamp(
      triggerRect.right - panelRect.width,
      viewportPadding,
      window.innerWidth - panelRect.width - viewportPadding,
    );
    const belowTop = triggerRect.bottom + 8;
    const aboveTop = triggerRect.top - panelRect.height - 8;
    const top =
      belowTop + panelRect.height <= window.innerHeight - viewportPadding
        ? belowTop
        : clamp(aboveTop, viewportPadding, window.innerHeight - panelRect.height - viewportPadding);

    setPosition({ left, top });
  }, [isMobile, openPanel, activityState]);

  useEffect(() => {
    if (!openPanel) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (
        activityButtonRef.current?.contains(target) ||
        profileButtonRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return;
      }

      setOpenPanel(null);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenPanel(null);
      }
    }

    function handleViewportChange() {
      setOpenPanel(null);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleViewportChange);

    if (!isMobile && openPanel === "profile") {
      window.addEventListener("scroll", handleViewportChange, true);
    }

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [isMobile, openPanel]);

  function togglePanel(panel: PanelKind) {
    setPosition(null);

    if (openPanel === panel) {
      setOpenPanel(null);
      return;
    }

    if (panel === "activity") {
      setActivityState("loading");
    }

    setOpenPanel(panel);
  }

  function closePanel() {
    setOpenPanel(null);
  }

  const panelStyle: CSSProperties | undefined =
    !isMobile && position ? { left: position.left, top: position.top } : !isMobile ? { left: 0, top: 0, visibility: "hidden" } : undefined;
  const panelId = openPanel === "activity" ? activityPanelId : profilePanelId;

  return (
    <div className="topbar-global-controls">
      <button
        aria-controls={openPanel === "activity" ? activityPanelId : undefined}
        aria-expanded={openPanel === "activity"}
        aria-haspopup="dialog"
        aria-label="Buka notifikasi"
        className="topbar-icon-button topbar-icon-button--notification"
        onClick={() => togglePanel("activity")}
        ref={activityButtonRef}
        title="Notifikasi"
        type="button"
      >
        <Bell size={17} aria-hidden="true" />
        {hasNotificationDot(activityItems) ? <span className="topbar-icon-button__dot" aria-hidden="true" /> : null}
      </button>

      <button
        aria-controls={openPanel === "profile" ? profilePanelId : undefined}
        aria-expanded={openPanel === "profile"}
        aria-haspopup="dialog"
        aria-label="Buka menu profil"
        className="topbar-profile-link topbar-profile-link--dense topbar-avatar-button"
        onClick={() => togglePanel("profile")}
        ref={profileButtonRef}
        title="Profil"
        type="button"
      >
        <AvatarThumbnailFrame
          className="topbar-profile-link__avatar"
          fallback="user-round"
          fallbackClassName="topbar-profile-link__avatar--fallback"
          iconSize={18}
          src={currentAffiliateProfile?.avatarUrl ?? null}
        />
        <span className="topbar-profile-link__label">Profil</span>
      </button>

      {openPanel
        ? createPortal(
            <div
              aria-label={openPanel === "activity" ? "Panel notifikasi" : "Menu profil"}
              className={cn(
                "topbar-floating-panel",
                isMobile && "topbar-floating-panel--sheet",
                openPanel === "activity" ? "topbar-activity-panel" : "topbar-profile-panel",
              )}
              data-panel={openPanel}
              id={panelId}
              ref={panelRef}
              role="dialog"
              style={panelStyle}
            >
              {openPanel === "activity" ? (
                <>
                  <PanelHeader onClose={closePanel} title="Notifikasi" subtitle="Aktivitas terbaru" />
                  <ActivityPanelContent items={activityItems} onNavigate={closePanel} state={activityState} />
                </>
              ) : (
                <>
                  <PanelHeader onClose={closePanel} title="Profil" subtitle="Menu operator" />
                  <ProfileMenuContent
                    currentAffiliateProfile={currentAffiliateProfile}
                    hideSettingsAction={hideSettingsAction}
                    onClose={closePanel}
                    themePreference={themePreference}
                  />
                </>
              )}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
