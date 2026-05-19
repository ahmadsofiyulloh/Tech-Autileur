"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type ActionToolbarProps = {
  action?: string;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  controlsClassName?: string;
  method?: "get" | "post";
  primaryAction?: ReactNode;
  search?: ReactNode;
  summary?: ReactNode;
  "aria-label"?: string;
};

export function ActionToolbar({
  action,
  actions,
  children,
  className,
  controlsClassName,
  method,
  primaryAction,
  search,
  summary,
  "aria-label": ariaLabel,
}: ActionToolbarProps) {
  const content = (
    <>
      <div className={cn("settings-list-toolbar", controlsClassName)}>
        {children}
        {search}
        {actions}
      </div>

      {summary || primaryAction ? (
        <div className="settings-inline-summary">
          {summary ? <span>{summary}</span> : null}
          {primaryAction}
        </div>
      ) : null}
    </>
  );

  const rootClassName = cn("operator-action-toolbar stack", className);

  if (method || action) {
    return (
      <form className={rootClassName} action={action} method={method} aria-label={ariaLabel}>
        {content}
      </form>
    );
  }

  return (
    <div className={rootClassName} aria-label={ariaLabel}>
      {content}
    </div>
  );
}
