"use client";

import { useEffect, useState } from "react";
import {
  THEME_COOKIE_MAX_AGE,
  THEME_COOKIE_NAME,
  THEME_PICKER_OPTIONS,
  type ResolvedTheme,
  type ThemePreference,
  resolveThemePreference,
} from "@/lib/theme-preference";

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

export function ThemeModePicker({ defaultValue }: { defaultValue: ThemePreference }) {
  const [selectedTheme, setSelectedTheme] = useState(defaultValue);

  useEffect(() => {
    setSelectedTheme(defaultValue);
    applyThemePreference(defaultValue);
  }, [defaultValue]);

  function selectTheme(nextTheme: ThemePreference) {
    setSelectedTheme(nextTheme);
    persistThemePreference(nextTheme);
    applyThemePreference(nextTheme);
  }

  return (
    <fieldset className="theme-mode-toggle">
      <legend>Tema</legend>
      <div className="theme-mode-toggle__options" role="group" aria-label="Tema">
        {THEME_PICKER_OPTIONS.map((option) => (
          <button
            aria-pressed={selectedTheme === option.value}
            className="theme-mode-toggle__option"
            data-active={selectedTheme === option.value ? "true" : undefined}
            key={option.value}
            type="button"
            onClick={() => selectTheme(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
