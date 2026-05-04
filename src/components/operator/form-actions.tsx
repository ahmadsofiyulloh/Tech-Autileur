import type { ReactNode } from "react";

export type FormActionsLayout = "auto" | "single" | "pair" | "triple" | "quad" | "stack";

type FormActionsProps = {
  children: ReactNode;
  className?: string;
  layout?: FormActionsLayout;
};

export function FormActions({ children, className, layout = "auto" }: FormActionsProps) {
  return <div className={`form-actions auth-actions action-rail action-rail--${layout} ${className ?? ""}`.trim()}>{children}</div>;
}
