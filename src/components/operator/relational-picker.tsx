"use client";

import { Check, ChevronDown, Search } from "lucide-react";
import { type CSSProperties, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

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

const MOBILE_PICKER_QUERY = "(max-width: 860px)";
const DESKTOP_PANEL_GAP = 8;
const DESKTOP_PANEL_MARGIN = 12;

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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
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
  const [mounted, setMounted] = useState(false);
  const [isMobileSheet, setIsMobileSheet] = useState(false);
  const [panelStyle, setPanelStyle] = useState<CSSProperties | undefined>(undefined);
  const showSearch = searchable !== false;

  const updatePanelGeometry = useCallback(() => {
    const trigger = triggerRef.current;

    if (!trigger) {
      return;
    }

    const nextIsMobile = window.matchMedia(MOBILE_PICKER_QUERY).matches;
    setIsMobileSheet(nextIsMobile);

    if (nextIsMobile) {
      setPanelStyle(undefined);
      return;
    }

    const rect = trigger.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
    const width = Math.round(rect.width);
    const maxLeft = Math.max(DESKTOP_PANEL_MARGIN, viewportWidth - width - DESKTOP_PANEL_MARGIN);
    const left = Math.min(Math.max(Math.round(rect.left), DESKTOP_PANEL_MARGIN), maxLeft);

    setPanelStyle({
      left,
      top: Math.round(rect.bottom + DESKTOP_PANEL_GAP),
      width,
    });
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

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

    updatePanelGeometry();

    const handlePointerDown = (event: PointerEvent) => {
      const root = rootRef.current;
      const panel = panelRef.current;
      if (
        event.target instanceof Node &&
        root &&
        !root.contains(event.target) &&
        (!panel || !panel.contains(event.target))
      ) {
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

    const handleWindowChange = () => {
      updatePanelGeometry();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleWindowChange);
    window.addEventListener("scroll", handleWindowChange, true);

    if (showSearch) {
      requestAnimationFrame(() => {
        searchInputRef.current?.focus();
      });
    }

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleWindowChange);
      window.removeEventListener("scroll", handleWindowChange, true);
    };
  }, [open, showSearch, updatePanelGeometry]);

  useEffect(() => {
    if (!open || !isMobileSheet) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open, isMobileSheet]);

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
  const pickerPanel = open ? (
    <>
      <button
        aria-hidden="true"
        className={`relational-picker__backdrop${isMobileSheet ? " relational-picker__backdrop--sheet" : ""}`}
        tabIndex={-1}
        type="button"
        onClick={() => {
          setOpen(false);
          setQuery("");
        }}
      />
      <div
        aria-labelledby={labelId}
        aria-modal="true"
        className={`relational-picker__panel${isMobileSheet ? " relational-picker__panel--sheet" : ""}`}
        id={panelId}
        ref={panelRef}
        role="dialog"
        style={panelStyle}
      >
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
  ) : null;

  return (
    <div
      ref={rootRef}
      className={`stack auth-field relational-picker${compact ? " relational-picker--compact" : ""}${className ? ` ${className}` : ""}`.trim()}
    >
      <span id={labelId}>{label}</span>
      <input ref={hiddenInputRef} aria-hidden="true" name={name} readOnly type="hidden" value={selectedValue} />
      <div className="relational-picker__control">
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
          ref={triggerRef}
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
      </div>
      {helperText ? (
        <p className="field-note" id={helperId}>
          {helperText}
        </p>
      ) : null}
      {mounted && pickerPanel ? createPortal(pickerPanel, document.body) : null}
    </div>
  );
}
