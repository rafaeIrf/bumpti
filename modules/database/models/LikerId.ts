import { Model } from "@nozbe/watermelondb";

/**
 * Liker ID - IDs de usuarios que curtiram o usuario atual
 */
export default class LikerId extends Model {
  static table = "liker_ids";
}
