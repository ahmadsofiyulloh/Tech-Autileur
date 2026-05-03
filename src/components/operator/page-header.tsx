import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

type PageHeaderStat = {
  label: string;
  value: ReactNode;
};

type PageHeaderProps = {
  badge?: string;
  eyebrow?: string;
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  stats?: PageHeaderStat[];
  className?: string;
};

export function PageHeader({
  badge,
  eyebrow,
  icon: Icon,
  title,
  description,
  actions,
  stats,
  className,
}: PageHeaderProps) {
  return (
    <section className={`hero page-header stack ${className ?? ""}`.trim()}>
      <div className="page-header__main">
        {Icon ? (
          <span className="icon-frame page-header__icon" aria-hidden="true">
            <Icon size={19} />
          </span>
        ) : null}
          <div className="stack page-header__copy">
          {badge ? <div className="chip">{badge}</div> : null}
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h2 className="page-header__title">{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="hero-actions page-header__actions">{actions}</div> : null}
      {stats?.length ? (
        <div className="metric-grid page-header__stats">
          {stats.map((stat) => (
            <div className="metric" key={stat.label}>
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
