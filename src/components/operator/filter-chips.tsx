"use client";

import { NativeLinkButton } from "@/components/ui/native-button";
import { cn } from "@/lib/utils";

type FilterChipItem = {
  active: boolean;
  href: string;
  key: string;
  label: string;
};

type FilterChipsProps = {
  items: FilterChipItem[];
  label: string;
  className?: string;
};

export function FilterChips({ className, items, label }: FilterChipsProps) {
  return (
    <div className={cn("operator-filter-chips content-filter-tabs", className)} role="tablist" aria-label={label}>
      {items.map((item) => (
        <NativeLinkButton
          aria-selected={item.active}
          className="operator-filter-chips__item content-filter-tab"
          data-active={item.active ? "true" : undefined}
          href={item.href}
          key={item.key}
          role="tab"
        >
          {item.label}
        </NativeLinkButton>
      ))}
    </div>
  );
}
