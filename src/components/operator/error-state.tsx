import type { ReactNode } from "react";
import { CircleAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type ErrorStateProps = {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  icon?: LucideIcon;
};

export function ErrorState({ title, description, action, icon: Icon = CircleAlert }: ErrorStateProps) {
  return (
    <section className="empty-state muted-box stack" role="alert" aria-live="assertive" aria-atomic="true">
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
