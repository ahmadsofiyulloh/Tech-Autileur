"use client";

import { ChevronDown } from "lucide-react";
import { type ComponentProps, type CSSProperties, useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CONTENT_VARIANTS } from "@/lib/prompts/content-variants";
import { RelationalPicker, type RelationalPickerOption } from "@/components/operator/relational-picker";
import { NativeButton } from "@/components/ui/native-button";

const VARIANT_OPTIONS: RelationalPickerOption[] = Object.values(CONTENT_VARIANTS).map((variant) => ({
  value: variant.key,
  label: variant.label,
}));

const FLOATING_PICKER_GAP = 6;
const FLOATING_PICKER_MARGIN = 10;
const FLOATING_PICKER_MIN_WIDTH = 176;
const FLOATING_PICKER_MAX_HEIGHT = 320;

type FormAction = NonNullable<ComponentProps<"form">["action"]>;
type VariantSubmitHiddenField = {
  name: string;
  value: string | number | null | undefined;
};

type VariantPickerProps = {
  className?: string;
  compact?: boolean;
  defaultValue?: string;
  disabled?: boolean;
  label?: string;
  name?: string;
};

export function VariantPicker({
  className,
  compact = true,
  defaultValue = "hero_hook",
  disabled,
  label = "Varian konten",
  name = "content_variant_key",
}: VariantPickerProps) {
  return (
    <RelationalPicker
      className={className}
      compact={compact}
      defaultValue={defaultValue}
      disabled={disabled}
      label={label}
      name={name}
      options={VARIANT_OPTIONS}
      searchable={false}
    />
  );
}

type VariantSubmitButtonProps = {
  action: FormAction;
  ariaDescribedBy?: string;
  buttonLabel: string;
  className?: string;
  disabled?: boolean;
  hiddenFields: VariantSubmitHiddenField[];
  pendingLabel?: string;
  pickerLabel?: string;
};

export function VariantSubmitButton({
  action,
  ariaDescribedBy,
  buttonLabel,
  className,
  disabled,
  hiddenFields,
  pickerLabel = "Pilih varian konten",
}: VariantSubmitButtonProps) {
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState<CSSProperties | undefined>(undefined);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLFormElement>(null);
  const panelId = useId();
  const normalizedFields = hiddenFields.filter((field) => field.value !== null && field.value !== undefined);

  const updatePanelGeometry = useCallback(() => {
    const trigger = triggerRef.current;

    if (!trigger) {
      return;
    }

    const rect = trigger.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
    const viewportHeight = document.documentElement.clientHeight || window.innerHeight;
    const width = Math.max(Math.round(rect.width), FLOATING_PICKER_MIN_WIDTH);
    const maxLeft = Math.max(FLOATING_PICKER_MARGIN, viewportWidth - width - FLOATING_PICKER_MARGIN);
    const left = Math.min(Math.max(Math.round(rect.left), FLOATING_PICKER_MARGIN), maxLeft);
    const roomBelow = viewportHeight - rect.bottom - FLOATING_PICKER_MARGIN;
    const roomAbove = rect.top - FLOATING_PICKER_MARGIN;
    const estimatedHeight = Math.min(FLOATING_PICKER_MAX_HEIGHT, VARIANT_OPTIONS.length * 38 + 8);
    const openAbove = roomBelow < estimatedHeight && roomAbove > roomBelow;
    const availableHeight = Math.max(
      132,
      Math.min(FLOATING_PICKER_MAX_HEIGHT, (openAbove ? roomAbove : roomBelow) - FLOATING_PICKER_GAP),
    );

    setPanelStyle({
      left,
      maxHeight: availableHeight,
      top: openAbove
        ? Math.max(FLOATING_PICKER_MARGIN, Math.round(rect.top - FLOATING_PICKER_GAP - availableHeight))
        : Math.min(
            Math.round(rect.bottom + FLOATING_PICKER_GAP),
            Math.max(FLOATING_PICKER_MARGIN, viewportHeight - availableHeight - FLOATING_PICKER_MARGIN),
          ),
      width,
    });
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    updatePanelGeometry();

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) {
        return;
      }

      setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", updatePanelGeometry);
    window.addEventListener("scroll", updatePanelGeometry, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", updatePanelGeometry);
      window.removeEventListener("scroll", updatePanelGeometry, true);
    };
  }, [open, updatePanelGeometry]);

  const picker = open ? (
    <form
      action={action}
      aria-label={pickerLabel}
      className="variant-submit-picker__panel variant-submit-picker__panel--floating"
      id={panelId}
      ref={panelRef}
      role="menu"
      style={panelStyle}
    >
      {normalizedFields.map((field, index) => (
        <input key={`${field.name}-${index}`} type="hidden" name={field.name} value={String(field.value)} />
      ))}
      <div className="variant-submit-picker__list" role="none">
        {VARIANT_OPTIONS.map((option) => (
          <button
            className="relational-picker__option variant-submit-picker__option"
            key={option.value}
            name="content_variant_key"
            role="menuitem"
            type="submit"
            value={option.value}
          >
            <span className="relational-picker__option-copy">
              <strong>{option.label}</strong>
            </span>
          </button>
        ))}
      </div>
    </form>
  ) : null;

  return (
    <>
      <NativeButton
        aria-controls={open ? panelId : undefined}
        aria-describedby={ariaDescribedBy}
        aria-expanded={open}
        aria-haspopup="menu"
        className={className}
        disabled={disabled}
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
      >
        <ChevronDown size={15} aria-hidden="true" />
        {buttonLabel}
      </NativeButton>
      {picker && typeof document !== "undefined" ? createPortal(picker, document.body) : null}
    </>
  );
}
