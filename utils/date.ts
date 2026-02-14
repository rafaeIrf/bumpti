import { t } from "@/modules/locales";

/**
 * Converts a date string to a relative date format
 * @param dateString - ISO date string
 * @returns "Hoje", "Ontem", or "X dias atrás" based on the current date
 */
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
