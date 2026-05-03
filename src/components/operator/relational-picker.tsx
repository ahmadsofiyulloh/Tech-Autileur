"use client";

import { Check, ChevronDown, Search } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

export type RelationalPickerOption = {
  value: string;
  label: string;
  description?: string;
};

type RelationalPickerProps = {
  label: string;
  name: string;
  options: RelationalPickerOption[];
  defaultValue?: string | null;
  placeholder?: string;
  emptyLabel?: string;
  allowClear?: boolean;
  required?: boolean;
  disabled?: boolean;
  helperText?: string;
  searchPlaceholder?: string;
  searchable?: boolean;
  submitOnSelect?: boolean;
  className?: string;
  compact?: boolean;
};

export function RelationalPicker({
  label,
  name,
  options,
  defaultValue,
  placeholder,
  emptyLabel,
  allowClear = false,
  required = false,
  disabled = false,
  helperText,
  searchPlaceholder,
  searchable = true,
  submitOnSelect = false,
  className,
  compact = false,
}: RelationalPickerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const triggerId = useId();
  const labelId = useId();
  const valueId = useId();
  const panelId = useId();
  const searchId = useId();
  const helperId = useId();
  const normalizedDefaultValue = defaultValue ?? "";
  const [selectedValue, setSelectedValue] = useState(normalizedDefaultValue);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const showSearch = searchable !== false;

  useEffect(() => {
    setSelectedValue(normalizedDefaultValue);
    if (hiddenInputRef.current) {
      hiddenInputRef.current.value = normalizedDefaultValue;
    }
  }, [normalizedDefaultValue]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const root = rootRef.current;
      if (root && event.target instanceof Node && !root.contains(event.target)) {
        setOpen(false);
        setQuery("");
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    if (showSearch) {
      requestAnimationFrame(() => {
        searchInputRef.current?.focus();
      });
    }

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, showSearch]);

  const selectedOption = useMemo(
    () => options.find((option) => option.value === selectedValue) ?? null,
    [options, selectedValue],
  );

  const filteredOptions = useMemo(() => {
    if (!showSearch) {
      return options;
    }

    const term = query.trim().toLowerCase();

    if (!term) {
      return options;
    }

    return options.filter((option) => {
      const haystack = [option.label, option.description ?? ""].join(" ").toLowerCase();
      return haystack.includes(term);
    });
  }, [options, query, showSearch]);

  function syncHiddenInput(nextValue: string) {
    if (hiddenInputRef.current) {
      hiddenInputRef.current.value = nextValue;
    }
  }

  function requestParentSubmit() {
    if (!submitOnSelect) {
      return;
    }

    const form = rootRef.current?.closest("form");
    form?.requestSubmit();
  }

  function selectValue(nextValue: string) {
    setSelectedValue(nextValue);
    syncHiddenInput(nextValue);
    setOpen(false);
    setQuery("");
    requestParentSubmit();
  }

  const labelText = selectedOption?.label ?? (selectedValue ? selectedValue : emptyLabel ?? placeholder ?? "Pilih");
  const subText = selectedOption?.description ?? (selectedValue ? undefined : helperText);
  const canClear = allowClear && selectedValue.length > 0;

  return (
    <div
      ref={rootRef}
      className={`stack auth-field relational-picker${compact ? " relational-picker--compact" : ""}${className ? ` ${className}` : ""}`.trim()}
    >
      <span id={labelId}>{label}</span>
      <input ref={hiddenInputRef} aria-hidden="true" name={name} readOnly type="hidden" value={selectedValue} />
      <button
        aria-controls={panelId}
        aria-describedby={helperText ? helperId : undefined}
        aria-required={required}
        aria-labelledby={`${labelId} ${valueId}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="relational-picker__trigger"
        disabled={disabled}
        id={triggerId}
        type="button"
        onClick={() => {
          if (disabled) {
            return;
          }

          setOpen((current) => !current);
        }}
      >
        <span className="relational-picker__value" id={valueId}>
          <strong>{labelText}</strong>
          {subText ? <span>{subText}</span> : null}
        </span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {helperText ? (
        <p className="field-note" id={helperId}>
          {helperText}
        </p>
      ) : null}
      {open ? (
        <>
          <button
            aria-hidden="true"
            className="relational-picker__backdrop"
            tabIndex={-1}
            type="button"
            onClick={() => {
              setOpen(false);
              setQuery("");
            }}
          />
          <div aria-labelledby={labelId} aria-modal="true" className="relational-picker__panel" id={panelId} role="dialog">
            <div className="relational-picker__panel-header">
              {showSearch ? (
                <label className="relational-picker__search" htmlFor={searchId}>
                  <Search size={15} aria-hidden="true" />
                  <span className="sr-only">{searchPlaceholder ?? `Cari ${label.toLowerCase()}`}</span>
                  <input
                    ref={searchInputRef}
                    id={searchId}
                    placeholder={searchPlaceholder ?? `Cari ${label.toLowerCase()}`}
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.currentTarget.value)}
                  />
                </label>
              ) : (
                <span className="relational-picker__panel-label">{label}</span>
              )}
              {canClear ? (
                <button
                  className="button compact relational-picker__clear"
                  type="button"
                  onClick={() => selectValue("")}
                >
                  Kosongkan
                </button>
              ) : null}
            </div>
            <div className="relational-picker__list" role="listbox" aria-label={label}>
              {allowClear ? (
                <button
                  aria-selected={!selectedValue}
                  className={`relational-picker__option${!selectedValue ? " is-selected" : ""}`}
                  role="option"
                  type="button"
                  onClick={() => selectValue("")}
                >
                  <span className="relational-picker__option-copy">
                    <strong>{emptyLabel ?? "Tidak ada pilihan"}</strong>
                    <span>{placeholder ?? "Gunakan nilai kosong."}</span>
                  </span>
                  {!selectedValue ? <Check size={16} aria-hidden="true" /> : null}
                </button>
              ) : null}
              {filteredOptions.length ? (
                filteredOptions.map((option) => (
                  <button
                    aria-selected={selectedValue === option.value}
                    className={`relational-picker__option${selectedValue === option.value ? " is-selected" : ""}`}
                    key={option.value}
                    role="option"
                    type="button"
                    onClick={() => selectValue(option.value)}
                  >
                    <span className="relational-picker__option-copy">
                      <strong>{option.label}</strong>
                      {option.description ? <span>{option.description}</span> : null}
                    </span>
                    {selectedValue === option.value ? <Check size={16} aria-hidden="true" /> : null}
                  </button>
                ))
              ) : (
                <div className="relational-picker__empty">Tidak ada opsi.</div>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
