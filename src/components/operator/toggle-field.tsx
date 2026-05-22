"use client";

import { useState } from "react";

type ToggleFieldProps = {
  label: string;
  name: string;
  defaultChecked?: boolean;
  helperText?: string;
  disabled?: boolean;
};

export function ToggleField({
  label,
  name,
  defaultChecked = true,
  helperText,
  disabled,
}: ToggleFieldProps) {
  const [checked, setChecked] = useState(defaultChecked);

  return (
    <label className="settings-native-row settings-switch-row">
      <span className="settings-native-row__copy">
        <strong>{label}</strong>
        {helperText && <span>{helperText}</span>}
      </span>
      <input
        className="settings-switch-row__toggle"
        type="checkbox"
        checked={checked}
        onChange={(e) => setChecked(e.target.checked)}
        disabled={disabled}
        aria-label={label}
      />
      <input type="hidden" name={name} value={checked ? "true" : "false"} />
    </label>
  );
}
