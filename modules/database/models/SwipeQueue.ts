import type { PresenceEntryType } from "@/utils/presence-badge";
import { Model } from "@nozbe/watermelondb";
import { date, field, readonly } from "@nozbe/watermelondb/decorators";

export type SwipeAction = "like" | "dislike";

/**
 * Context attached to a swipe: the raw entry_type of the swiped user.
 * Persisted to survive offline queue flush.
 * Backend maps this to the correct match_origin.
 */
export type SwipeContext = PresenceEntryType | null;

/**
 * Fila local de interacoes pendentes (swipes)
 */
export default class SwipeQueue extends Model {
  static table = "swipes_queue";

  @field("target_user_id") targetUserId!: string;
  @field("action") action!: SwipeAction;
  @field("place_id") placeId!: string;
  /** Optional: 'regular' when the target was surfaced as a frequentador. */
  @field("context") context!: SwipeContext;
  @readonly @date("created_at") createdAt!: Date;
}
