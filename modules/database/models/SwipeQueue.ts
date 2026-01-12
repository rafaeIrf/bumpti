import { Model } from "@nozbe/watermelondb";
import { date, field, readonly } from "@nozbe/watermelondb/decorators";

export type SwipeAction = "like" | "dislike";

/**
 * Fila local de interacoes pendentes (swipes)
 */
export default class SwipeQueue extends Model {
  static table = "swipes_queue";

  @field("target_user_id") targetUserId!: string;
  @field("action") action!: SwipeAction;
  @field("place_id") placeId!: string;
  @readonly @date("created_at") createdAt!: Date;
}
