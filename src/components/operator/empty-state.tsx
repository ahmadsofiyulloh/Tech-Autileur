import type { ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  description: ReactNode;
  action?: ReactNode;
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <section className="empty-state muted-box stack" aria-live="polite">
      <div className="stack">
        <p className="eyebrow">Empty state</p>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      {action ? <div className="empty-state__action">{action}</div> : null}
    </section>
  );
}
