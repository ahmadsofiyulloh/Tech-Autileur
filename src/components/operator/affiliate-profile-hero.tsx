import Link from "next/link";
import { ChevronRight, UserRound } from "lucide-react";
import { StatusBadge } from "@/components/operator/status-badge";
import type { ReactNode } from "react";

type StatusTone = "neutral" | "info" | "success" | "warning" | "danger";

type AffiliateProfileHeroProps = {
  title: string;
  avatarUrl: string | null;
  nicheLabel?: string | null;
  accountLabel?: string | null;
  statusLabel?: string | null;
  statusTone?: StatusTone;
  actions?: ReactNode;
  href?: string;
  actionLabel?: string;
  eyebrow?: string;
  variant?: "default" | "overview";
};

export function AffiliateProfileHero({
  title,
  avatarUrl,
  nicheLabel,
  accountLabel,
  statusLabel,
  statusTone,
  actions,
  href,
  actionLabel = "Kelola profile",
  eyebrow = "Profile aktif",
  variant = "default",
}: AffiliateProfileHeroProps) {
  const heroActions = actions ?? (href ? (
    <Link className="button compact tertiary" href={href}>
      <ChevronRight size={15} aria-hidden="true" />
      {actionLabel}
    </Link>
  ) : null);

  return (
    <section className={`settings-native-card settings-profile-hero settings-profile-hero--${variant}`}>
      <div className="settings-profile-hero__avatar" aria-hidden="true">
        {avatarUrl ? <img alt="" src={avatarUrl} /> : <UserRound size={28} />}
      </div>
      <div className="settings-profile-hero__copy">
        <span className="settings-profile-hero__eyebrow">{eyebrow}</span>
        <strong>{title}</strong>
        {nicheLabel || accountLabel ? (
          <div className="settings-profile-hero__meta">
            {nicheLabel ? <span>{nicheLabel}</span> : null}
            {accountLabel ? <span>{accountLabel}</span> : null}
          </div>
        ) : null}
        <div className="settings-profile-hero__footer">
          {statusLabel ? <StatusBadge status={statusLabel} tone={statusTone} /> : null}
          {heroActions ? <div className="settings-profile-hero__actions">{heroActions}</div> : null}
        </div>
      </div>
    </section>
  );
}
