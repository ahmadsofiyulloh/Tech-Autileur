export const APP_TIME_ZONE = "Asia/Jakarta";
export const APP_TIME_OFFSET = "+07:00";
export const APP_TIME_LOCALE = "id-ID";

type DateInput = Date | number | string | null | undefined;

function toValidDate(value: DateInput) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function appDateTimeParts(value: DateInput) {
  const date = toValidDate(value) ?? new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone: APP_TIME_ZONE,
    year: "numeric",
  }).formatToParts(date);
  const partMap = new Map(parts.map((part) => [part.type, part.value]));

  return {
    day: partMap.get("day") ?? "01",
    hour: partMap.get("hour") ?? "00",
    minute: partMap.get("minute") ?? "00",
    month: partMap.get("month") ?? "01",
    second: partMap.get("second") ?? "00",
    year: partMap.get("year") ?? "1970",
  };
}

export function formatAppDateTime(value: DateInput, fallback = "Belum ada") {
  const date = toValidDate(value);

  if (!date) {
    return fallback;
  }

  return new Intl.DateTimeFormat(APP_TIME_LOCALE, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: APP_TIME_ZONE,
  }).format(date);
}

export function formatAppShortDateTime(value: DateInput, fallback = "Belum ada") {
  const date = toValidDate(value);

  if (!date) {
    return fallback;
  }

  return new Intl.DateTimeFormat(APP_TIME_LOCALE, {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    timeZone: APP_TIME_ZONE,
  }).format(date);
}

export function formatAppDateKey(value: DateInput = new Date()) {
  const date = toValidDate(value) ?? new Date();
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIME_ZONE }).format(date);
}

export function formatAppTimestampCode(value: DateInput = new Date()) {
  const parts = appDateTimeParts(value);
  return `${parts.year}${parts.month}${parts.day}${parts.hour}${parts.minute}${parts.second}`;
}

export function formatAppOffsetIsoString(value: DateInput = new Date()) {
  const parts = appDateTimeParts(value);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${APP_TIME_OFFSET}`;
}
