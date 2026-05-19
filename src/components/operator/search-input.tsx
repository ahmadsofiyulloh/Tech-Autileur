"use client";

import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

type SearchInputProps = {
  defaultValue?: string;
  id: string;
  label: string;
  name: string;
  placeholder?: string;
  className?: string;
};

export function SearchInput({ className, defaultValue, id, label, name, placeholder }: SearchInputProps) {
  return (
    <label className={cn("operator-search-input product-search", className)} htmlFor={id}>
      <Search size={16} aria-hidden="true" />
      <span className="sr-only">{label}</span>
      <input id={id} name={name} placeholder={placeholder} defaultValue={defaultValue} aria-label={label} />
    </label>
  );
}
