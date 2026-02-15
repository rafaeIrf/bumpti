import { t } from "@/modules/locales";
import type { PlanPeriod } from "@/modules/plans/types";
import * as Localization from "expo-localization";

// ── Locale ───────────────────────────────────────────────────────────

/** Returns the device's primary locale tag (e.g. "pt-BR"). */
export function getDeviceLocaleTag(): string {
  const locales = Localization.getLocales();
  return locales?.[0]?.languageTag ?? "en-US";
}

// ── Date strings ─────────────────────────────────────────────────────

/**
 * Returns a local date as "YYYY-MM-DD".
 * @param offsetDays – number of days from today (0 = today, 1 = tomorrow, …).
 */
export function getLocalDateString(offsetDays = 0): string {
  const d = new Date();
  if (offsetDays > 0) d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/**
 * Checks if a "YYYY-MM-DD" string matches today's local date.
 * Safe from timezone issues because it never parses the string into a Date object.
 */
export function isDateToday(dateString?: string | null): boolean {
  if (!dateString) return false;
  return dateString === getLocalDateString();
}

/** Checks if a "YYYY-MM-DD" string matches tomorrow's local date. */
export function isDateTomorrow(dateString?: string | null): boolean {
  if (!dateString) return false;
  return dateString === getLocalDateString(1);
}

// ── Relative / human-friendly labels ─────────────────────────────────

export function getRelativeDate(dateString?: string): string {
  if (!dateString) return "";

  const matchDate = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - matchDate.getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return t("common.today");
  if (diffDays === 1) return t("common.yesterday");
  return t("common.daysAgo", { count: diffDays });
}

/**
 * Returns a capitalized, locale-aware weekday name from a "YYYY-MM-DD" string.
 * E.g. "2026-02-18" → "Terça" (pt-BR) or "Tuesday" (en-US).
 */
export function getLocalizedWeekday(
  dateString: string,
  style: "long" | "short" = "long"
): string {
  const localeTag = getDeviceLocaleTag();
  const d = new Date(dateString + "T12:00:00"); // noon avoids timezone shift
  const raw = d.toLocaleDateString(localeTag, { weekday: style });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

// ── Plan-specific labels ─────────────────────────────────────────────

const PERIOD_KEY_MAP: Record<PlanPeriod, { today: string; tomorrow: string; future: string }> = {
  morning:   { today: "todayMorning",   tomorrow: "tomorrowMorning",   future: "futureMorning" },
  afternoon: { today: "todayAfternoon", tomorrow: "tomorrowAfternoon", future: "futureAfternoon" },
  night:     { today: "todayNight",     tomorrow: "tomorrowNight",     future: "futureNight" },
};

/**
 * Returns a human-friendly label for a plan's time slot.
 * Examples: "Hoje à tarde", "Amanhã à noite", "Quarta de manhã".
 */
export function getPeriodLabel(plannedFor: string, period: PlanPeriod): string {
  const keys = PERIOD_KEY_MAP[period];

  if (isDateToday(plannedFor)) {
    return t(`screens.home.planHero.periodLabels.${keys.today}`);
  }

  if (isDateTomorrow(plannedFor)) {
    return t(`screens.home.planHero.periodLabels.${keys.tomorrow}`);
  }

  const weekday = getLocalizedWeekday(plannedFor);
  return t(`screens.home.planHero.periodLabels.${keys.future}`, { weekday });
}

/**
 * Returns a user-friendly label for a day selector pill.
 * 0 → "Hoje", 1 → "Amanhã", 2+ → "Terça", "Quarta", etc.
 */
export function getDayLabel(offset: number): string {
  if (offset === 0) return t("screens.home.createPlan.period.days.today");
  if (offset === 1) return t("screens.home.createPlan.period.days.tomorrow");

  const d = new Date();
  d.setDate(d.getDate() + offset);
  return getLocalizedWeekday(
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
    "long"
  );
}

/**
 * Returns a lowercased day label for a "YYYY-MM-DD" planned date.
 * Used as the {{when}} interpolation in confirmed-count strings.
 * E.g. "hoje", "amanhã", "na Quarta".
 */
export function getWhenLabel(plannedFor: string): string {
  if (isDateToday(plannedFor)) return t("common.today").toLowerCase();
  if (isDateTomorrow(plannedFor)) return t("common.tomorrow").toLowerCase();
  return getLocalizedWeekday(plannedFor);
}
