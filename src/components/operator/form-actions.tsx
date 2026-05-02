import type { ReactNode } from "react";

type FormActionsProps = {
  children: ReactNode;
  className?: string;
};

export function FormActions({ children, className }: FormActionsProps) {
  return <div className={`form-actions auth-actions ${className ?? ""}`.trim()}>{children}</div>;
}
