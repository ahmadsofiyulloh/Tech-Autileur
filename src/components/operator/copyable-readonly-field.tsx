import { CopyButton } from "@/components/operator/copy-button";

type CopyableReadOnlyFieldProps = {
  label: string;
  value: string;
  copyLabel?: string;
  emptyLabel?: string;
  className?: string;
};

export function CopyableReadOnlyField({
  label,
  value,
  copyLabel = "Salin",
  emptyLabel = "Belum ada.",
  className,
}: CopyableReadOnlyFieldProps) {
  const trimmedValue = value.trim();

  return (
    <div className={`prompt-readonly-field${className ? ` ${className}` : ""}`.trim()}>
      <div className="prompt-readonly-field__header">
        <strong>{label}</strong>
        <CopyButton className="tertiary" disabled={!trimmedValue} label={copyLabel} text={trimmedValue} />
      </div>
      <pre className="prompt-readonly-field__body" data-empty={!trimmedValue ? "true" : undefined}>
        {trimmedValue || emptyLabel}
      </pre>
    </div>
  );
}
