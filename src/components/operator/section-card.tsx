import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

type SectionCardProps = {
  badge?: string;
  icon?: LucideIcon;
  title?: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function SectionCard({ badge, icon: Icon, title, description, actions, children, className }: SectionCardProps) {
  return (
    <section className={`section-card panel stack ${className ?? ""}`.trim()}>
      {badge || title || description || actions ? (
        <div className="section-card__header">
          <div className="section-card__title-row">
            {Icon ? (
              <span className="icon-frame section-card__icon" aria-hidden="true">
                <Icon size={18} />
              </span>
            ) : null}
            <div className="stack-tight">
              {badge ? <p className="eyebrow">{badge}</p> : null}
              {title ? <h3 className="section-card__title">{title}</h3> : null}
              {description ? <p>{description}</p> : null}
            </div>
          </div>
          {actions ? <div className="section-card__actions">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
