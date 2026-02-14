import { t } from "@/modules/locales";

/**
 * Converts a date string to a relative date format
 * @param dateString - ISO date string
 * @returns "Hoje", "Ontem", or "X dias atrás" based on the current date
 */
/**
 * Returns the local date as "YYYY-MM-DD".
 */
function getLocalDateString(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Checks if a "YYYY-MM-DD" date string matches today's local date.
 * Safe from timezone issues because it never parses the string into a Date object.
 */
export function isDateToday(dateString?: string | null): boolean {
  if (!dateString) return false;
  return dateString === getLocalDateString();
}

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
