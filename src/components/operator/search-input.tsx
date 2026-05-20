"use client";

import { Search, X } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type SearchInputProps = {
  defaultValue?: string;
  id: string;
  label: string;
  name: string;
  placeholder?: string;
  className?: string;
  clearHref?: string;
  clearLabel?: string;
};

export function SearchInput({
  className,
  clearHref,
  clearLabel = "Bersihkan pencarian",
  defaultValue,
  id,
  label,
  name,
  placeholder,
}: SearchInputProps) {
  const hasClear = Boolean(clearHref && defaultValue?.trim());

  return (
    <label className={cn("operator-search-input product-search", className)} data-has-clear={hasClear ? "true" : undefined} htmlFor={id}>
      <Search size={16} aria-hidden="true" />
      <span className="sr-only">{label}</span>
      <input id={id} name={name} placeholder={placeholder} defaultValue={defaultValue} aria-label={label} />
      {hasClear && clearHref ? (
        <Link className="operator-search-input__clear" href={clearHref} aria-label={clearLabel}>
          <X size={14} aria-hidden="true" />
        </Link>
      ) : null}
    </label>
  );
}
