import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type DataListProps = {
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  contentClassName?: string;
  empty?: boolean;
  emptyState?: ReactNode;
  errorState?: ReactNode;
  headerClassName?: string;
  loading?: boolean;
  loadingState?: ReactNode;
  summary?: ReactNode;
  title?: ReactNode;
  toolbar?: ReactNode;
  "aria-label"?: string;
  "aria-labelledby"?: string;
};

export function DataList({
  actions,
  children,
  className,
  contentClassName,
  empty,
  emptyState,
  errorState,
  headerClassName,
  loading,
  loadingState,
  summary,
  title,
  toolbar,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
}: DataListProps) {
  const body = errorState ?? (loading ? loadingState : empty ? emptyState : children);
  const showHeader = Boolean(title || summary || actions);

  return (
    <section className={cn("operator-data-list stack", className)} aria-label={ariaLabel} aria-labelledby={ariaLabelledBy}>
      {toolbar}
      {showHeader ? (
        <div className={cn("section-card__actions", headerClassName)}>
          {title || summary ? (
            <div className="stack-tight">
              {title ? <strong>{title}</strong> : null}
              {summary ? <span className="settings-card-meta-line">{summary}</span> : null}
            </div>
          ) : null}
          {actions}
        </div>
      ) : null}
      <div className={cn("operator-data-list__body", contentClassName)}>{body}</div>
    </section>
  );
}
