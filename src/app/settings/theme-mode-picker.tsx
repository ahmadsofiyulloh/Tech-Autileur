"use client";

import { useEffect, useState } from "react";
import { Moon, Monitor, Sun, type LucideIcon } from "lucide-react";
import {
  THEME_COOKIE_MAX_AGE,
  THEME_COOKIE_NAME,
  type ResolvedTheme,
  type ThemePreference,
  resolveThemePreference,
} from "@/lib/theme-preference";

type ThemeToggleOption = {
  value: ThemePreference;
  ariaLabel: string;
  Icon: LucideIcon;
};

const THEME_TOGGLE_OPTIONS: ThemeToggleOption[] = [
  { value: "light", ariaLabel: "Light theme", Icon: Sun },
  { value: "system", ariaLabel: "System theme", Icon: Monitor },
  { value: "dark", ariaLabel: "Dark theme", Icon: Moon },
];

function systemTheme(): ResolvedTheme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function updateThemeColor() {
  const themeColor = window.getComputedStyle(document.documentElement).getPropertyValue("--color-shell-canvas").trim();
  const themeColorMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');

  if (themeColor && themeColorMeta) {
    themeColorMeta.content = themeColor;
  }
}

function persistThemePreference(preference: ThemePreference) {
  document.cookie = `${THEME_COOKIE_NAME}=${preference}; Path=/; Max-Age=${THEME_COOKIE_MAX_AGE}; SameSite=Lax`;
}

function applyThemePreference(preference: ThemePreference) {
  const resolvedTheme = resolveThemePreference(preference, systemTheme());
  document.documentElement.dataset.themeMode = preference;
  document.documentElement.dataset.theme = resolvedTheme;
  requestAnimationFrame(updateThemeColor);
}

export type ThemeToggleProps = {
  initialTheme?: ThemePreference;
  onThemeChange?: (theme: ThemePreference) => void;
};

export function ThemeToggle({ initialTheme = "system", onThemeChange }: ThemeToggleProps) {
  const [selectedTheme, setSelectedTheme] = useState<ThemePreference>(initialTheme);

  useEffect(() => {
    setSelectedTheme(initialTheme);
    applyThemePreference(initialTheme);
  }, [initialTheme]);

  function selectTheme(nextTheme: ThemePreference) {
    if (nextTheme === selectedTheme) {
      return;
    }

    setSelectedTheme(nextTheme);
    persistThemePreference(nextTheme);
    applyThemePreference(nextTheme);
    onThemeChange?.(nextTheme);
  }

  const activeIndex = Math.max(
    0,
    THEME_TOGGLE_OPTIONS.findIndex((option) => option.value === selectedTheme),
  );

  return (
    <div className="theme-mode-toggle">
      <div className="theme-mode-toggle__label">
        <span aria-hidden="true" className="theme-mode-toggle__label-icon settings-native-row__icon">
          <Moon size={18} />
        </span>
        <span className="theme-mode-toggle__label-text">Mode Tema</span>
      </div>

      <div className="theme-mode-toggle__switch" role="group" aria-label="Pilih tema">
        <span
          className="theme-mode-toggle__indicator"
          style={{ transform: `translateX(${activeIndex * 100}%)` }}
          aria-hidden="true"
        />
        {THEME_TOGGLE_OPTIONS.map((option) => {
          const isActive = selectedTheme === option.value;
          const Icon = option.Icon;

          return (
            <button
              key={option.value}
              type="button"
              aria-label={option.ariaLabel}
              aria-pressed={isActive}
              className="theme-mode-toggle__option"
              data-active={isActive ? "true" : undefined}
              onClick={() => selectTheme(option.value)}
            >
              <Icon aria-hidden="true" className="theme-mode-toggle__option-icon" size={14} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ThemeModePicker({ defaultValue }: { defaultValue: ThemePreference }) {
  return <ThemeToggle initialTheme={defaultValue} />;
}
