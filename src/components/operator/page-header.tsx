import type { ReactNode } from "react";

type PageHeaderStat = {
  label: string;
  value: ReactNode;
};

type PageHeaderProps = {
  badge?: string;
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  stats?: PageHeaderStat[];
  className?: string;
};

export function PageHeader({
  badge,
  eyebrow,
  title,
  description,
  actions,
  stats,
  className,
}: PageHeaderProps) {
  return (
    <section className={`hero page-header stack ${className ?? ""}`.trim()}>
      {badge ? <div className="chip">{badge}</div> : null}
      <div className="stack">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
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
