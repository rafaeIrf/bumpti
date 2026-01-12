import { Model } from '@nozbe/watermelondb';
import { date, field, readonly } from '@nozbe/watermelondb/decorators';

export default class Match extends Model {
  static table = 'matches';

  @field('chat_id') chatId?: string;
  @field('user_a') userA!: string;
  @field('user_b') userB!: string;
  @field('status') status!: string;
  @date('matched_at') matchedAt!: Date;
  @date('unmatched_at') unmatchedAt?: Date;
  @field('place_id') placeId?: string;
  @date('user_a_opened_at') userAOpenedAt?: Date;
  @date('user_b_opened_at') userBOpenedAt?: Date;
  @readonly @date('synced_at') syncedAt!: Date;

  @field('other_user_id') otherUserId?: string;
  @field('other_user_name') otherUserName?: string;
  @field('other_user_photo_url') otherUserPhotoUrl?: string;
  @field('place_name') placeName?: string;
  @date('first_message_at') firstMessageAt?: Date;

  /**
   * Marca o match como aberto pelo usuário atual
   */
  async markAsOpened(userId: string): Promise<void> {
    await this.update(match => {
      const isUserA = match.userA === userId;
      if (isUserA && !match.userAOpenedAt) {
        match.userAOpenedAt = new Date();
      } else if (!isUserA && !match.userBOpenedAt) {
        match.userBOpenedAt = new Date();
      }
    });
  }

  /**
   * Verifica se é um novo match para o usuário
   */
  isNewMatch(userId: string): boolean {
    const isUserA = this.userA === userId;
    const openedAt = isUserA ? this.userAOpenedAt : this.userBOpenedAt;
    return !openedAt;
  }
}
