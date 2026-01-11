import { Model } from "@nozbe/watermelondb";
import { date, field, readonly } from "@nozbe/watermelondb/decorators";

/**
 * Cache efêmero do feed de discovery
 */
export default class DiscoveryProfile extends Model {
  static table = "discovery_profiles";

  @field("raw_data") rawData!: string;
  @field("place_id") placeId!: string;
  @date("last_fetched_at") lastFetchedAt!: Date;
  @readonly @date("created_at") createdAt!: Date;

  get data(): any {
    try {
      return JSON.parse(this.rawData);
    } catch {
      return null;
    }
  }
}
