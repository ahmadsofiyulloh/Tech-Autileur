import type { ReactNode } from "react";
import { CircleDashed } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type EmptyStateProps = {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  icon?: LucideIcon;
};

export function EmptyState({ title, description, action, icon: Icon = CircleDashed }: EmptyStateProps) {
  return (
    <section className="empty-state muted-box stack" aria-live="polite">
      <div className="empty-state__body">
        <span className="icon-frame empty-state__icon" aria-hidden="true">
          <Icon size={18} />
        </span>
        <div className="stack-tight">
          <h3 className="empty-state__title">{title}</h3>
          {description ? <p>{description}</p> : null}
        </div>
      </div>
      {action ? <div className="empty-state__action">{action}</div> : null}
    </section>
  );
}
