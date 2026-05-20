"use client";

import { Moon, Monitor, Sun, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
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
const THEME_PREFERENCE_CHANGE_EVENT = "aicos-theme-preference-change";
const THEME_PREFERENCE_VALUES = new Set<ThemePreference>(["light", "dark", "system"]);

function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === "string" && THEME_PREFERENCE_VALUES.has(value as ThemePreference);
}

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

function readCurrentThemePreference(fallback: ThemePreference) {
  if (typeof document === "undefined") {
    return fallback;
  }

  const datasetPreference = document.documentElement.dataset.themeMode;
  return isThemePreference(datasetPreference) ? datasetPreference : fallback;
}

export type ThemeToggleProps = {
  className?: string;
  initialTheme?: ThemePreference;
  label?: string;
  onThemeChange?: (theme: ThemePreference) => void;
};

export function ThemeToggle({
  className,
  initialTheme = "system",
  label = "Mode Tema",
  onThemeChange,
}: ThemeToggleProps) {
  const [selectedTheme, setSelectedTheme] = useState<ThemePreference>(() => readCurrentThemePreference(initialTheme));

  useEffect(() => {
    applyThemePreference(selectedTheme);
  }, [selectedTheme]);

  useEffect(() => {
    function handleThemePreferenceChange(event: Event) {
      const nextTheme = (event as CustomEvent<ThemePreference>).detail;

      if (isThemePreference(nextTheme)) {
        setSelectedTheme(nextTheme);
      }
    }

    window.addEventListener(THEME_PREFERENCE_CHANGE_EVENT, handleThemePreferenceChange);

    return () => {
      window.removeEventListener(THEME_PREFERENCE_CHANGE_EVENT, handleThemePreferenceChange);
    };
  }, []);

  function selectTheme(nextTheme: ThemePreference) {
    if (nextTheme === selectedTheme) {
      return;
    }

    setSelectedTheme(nextTheme);
    persistThemePreference(nextTheme);
    window.dispatchEvent(new CustomEvent<ThemePreference>(THEME_PREFERENCE_CHANGE_EVENT, { detail: nextTheme }));
    onThemeChange?.(nextTheme);
  }

  const activeIndex = Math.max(
    0,
    THEME_TOGGLE_OPTIONS.findIndex((option) => option.value === selectedTheme),
  );

  return (
    <div className={cn("theme-mode-toggle", className)}>
      <div className="theme-mode-toggle__label">
        <span aria-hidden="true" className="theme-mode-toggle__label-icon settings-native-row__icon">
          <Moon size={18} />
        </span>
        <span className="theme-mode-toggle__label-text">{label}</span>
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
