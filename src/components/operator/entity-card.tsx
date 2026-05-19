import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type EntityCardProps = Omit<HTMLAttributes<HTMLElement>, "title"> & {
  actions?: ReactNode;
  active?: boolean;
  eyebrow?: ReactNode;
  footer?: ReactNode;
  media?: ReactNode;
  meta?: ReactNode;
  selected?: boolean;
  status?: ReactNode;
  title: ReactNode;
};

export function EntityCard({
  actions,
  active,
  children,
  className,
  eyebrow,
  footer,
  media,
  meta,
  selected,
  status,
  title,
  ...props
}: EntityCardProps) {
  return (
    <article
      {...props}
      className={cn("operator-entity-card product-card settings-list-card", className)}
      data-active={active ? "true" : undefined}
      data-selected={selected ? "true" : undefined}
    >
      <div className="settings-list-card__header">
        <div className={cn(media ? "operator-entity-card__identity" : "stack-tight")}>
          {media ? <span className="operator-entity-card__media">{media}</span> : null}
          <div className="stack-tight">
            {eyebrow ? <span className="settings-card-meta-line">{eyebrow}</span> : null}
            <strong>{title}</strong>
            {meta ? <span className="settings-card-meta-line">{meta}</span> : null}
          </div>
        </div>
        {status}
      </div>
      {children}
      {footer ? <div className="visual-list-card__footer">{footer}</div> : null}
      {actions ? <div className="mobile-card-actions">{actions}</div> : null}
    </article>
  );
}
