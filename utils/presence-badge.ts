import { t } from "@/modules/locales";
import { getLocalizedWeekday, isDateToday, isDateTomorrow } from "@/utils/date";

// ── Types ────────────────────────────────────────────────────────────

export type PresenceEntryType =
  | "physical"
  | "checkin_plus"
  | "planning"
  | "past_visitor"
  | "favorite";

export type PresenceBadgeIcon =
  | "dot"
  | "sparkles"
  | "mapPin"
  | "star"
  | "calendar";

export interface PresenceBadge {
  /** Already-resolved label string (call t() internally) */
  label: string;
  /** Icon variant to render */
  icon: PresenceBadgeIcon;
  /** Whether to render as highlighted (blue) badge */
  highlighted: boolean;
}

// ── Main resolver ────────────────────────────────────────────────────

/**
 * Pure resolver for presence badge configuration.
 * Centralizes all badge logic for the user profile card.
 *
 * @param entryType - The user's presence type at the place
 * @param plannedFor - ISO date string for planning entries (YYYY-MM-DD)
 * @returns Badge config or null if entry type is unknown
 */
export function getPresenceBadge(
  entryType: PresenceEntryType | undefined | null,
  plannedFor?: string | null,
): PresenceBadge | null {
  if (!entryType) return null;

  switch (entryType) {
    case "physical":
      return {
        label: t("userProfile.hereNow"),
        icon: "dot",
        highlighted: true,
      };

    case "checkin_plus":
      return {
        label: t("userProfile.planningToGo"),
        icon: "sparkles",
        highlighted: true,
      };

    case "planning":
      return resolvePlanningBadge(plannedFor);

    case "past_visitor":
      return {
        label: t("userProfile.frequentsPlace"),
        icon: "mapPin",
        highlighted: true,
      };

    case "favorite":
      return {
        label: t("userProfile.favoritedPlace"),
        icon: "star",
        highlighted: true,
      };

    default:
      return null;
  }
}

// ── Planning badge (supports 7-day range) ────────────────────────────

/**
 * Resolves the planning badge label for up to 7 days ahead.
 *
 * today     → "Planejando ir hoje"
 * tomorrow  → "Planejando ir amanhã"
 * 2-7 days  → "Planejando ir na Quarta"
 * past/null → "Planejando ir" (fallback)
 */
function resolvePlanningBadge(plannedFor?: string | null): PresenceBadge {
  if (!plannedFor) {
    return {
      label: t("userProfile.planningToGo"),
      icon: "sparkles",
      highlighted: true,
    };
  }

  if (isDateToday(plannedFor)) {
    return {
      label: t("userProfile.planningToGoToday"),
      icon: "sparkles",
      highlighted: true,
    };
  }

  if (isDateTomorrow(plannedFor)) {
    return {
      label: t("userProfile.planningToGoTomorrow"),
      icon: "sparkles",
      highlighted: true,
    };
  }

  // 2-7 days ahead: show weekday name
  const weekday = getLocalizedWeekday(plannedFor);
  return {
    label: t("userProfile.planningToGoOn", { weekday }),
    icon: "calendar",
    highlighted: true,
  };
}
