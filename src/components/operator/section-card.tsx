import type { ReactNode } from "react";

type SectionCardProps = {
  badge?: string;
  title?: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function SectionCard({ badge, title, description, actions, children, className }: SectionCardProps) {
  return (
    <section className={`section-card panel stack ${className ?? ""}`.trim()}>
      {badge || title || description || actions ? (
        <div className="section-card__header stack">
          <div className="stack">
            {badge ? <p className="eyebrow">{badge}</p> : null}
            {title ? <h3>{title}</h3> : null}
            {description ? <p>{description}</p> : null}
          </div>
          {actions ? <div className="section-card__actions">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
