export const THEME_COOKIE_NAME = "aicos_theme";
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const THEME_PREFERENCES = ["light", "dark", "system"] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];
export type ResolvedTheme = "light" | "dark";

export const DEFAULT_THEME_PREFERENCE: ThemePreference = "light";
export const DEFAULT_RESOLVED_THEME: ResolvedTheme = "light";

export const THEME_PICKER_OPTIONS = [
  { value: "light", label: "Terang" },
  { value: "dark", label: "Gelap" },
  { value: "system", label: "Ikuti Sistem" },
] as const;

export function readThemePreference(value: string | null | undefined): ThemePreference {
  if (THEME_PREFERENCES.includes(value as ThemePreference)) {
    return value as ThemePreference;
  }

  return DEFAULT_THEME_PREFERENCE;
}

export function resolveThemePreference(
  preference: ThemePreference,
  systemTheme: ResolvedTheme = DEFAULT_RESOLVED_THEME,
): ResolvedTheme {
  return preference === "system" ? systemTheme : preference;
}

