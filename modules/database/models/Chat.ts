import { Model, Q, Query } from '@nozbe/watermelondb';
import { children, date, field, lazy, readonly } from '@nozbe/watermelondb/decorators';
import Message from './Message';

export default class Chat extends Model {
  static table = 'chats';
  
  static associations = {
    messages: { type: 'has_many' as const, foreignKey: 'chat_id' },
  };

  @field('match_id') matchId!: string;
  @date('created_at') createdAt!: Date;
  @field('last_message_content') lastMessageContent?: string;
  @date('last_message_at') lastMessageAt?: Date;
  @field('other_user_id') otherUserId!: string;
  @field('other_user_name') otherUserName?: string;
  @field('other_user_photo_url') otherUserPhotoUrl?: string;
  @field('place_id') placeId?: string;
  @field('place_name') placeName?: string;
  @field('unread_count') unreadCount!: number;
  @readonly @date('synced_at') syncedAt!: Date;

  @children('messages') messages!: Query<Message>;

  /**
   * Query para obter a última mensagem do chat (para preview)
   * Usando @lazy para evitar recriação desnecessária da query
   */
  @lazy latestMessageQuery = this.messages.extend(
    Q.sortBy('created_at', Q.desc),
    Q.take(1)
  );

  /**
   * Marca todas as mensagens do chat como lidas
   */
  async markAllAsRead(): Promise<void> {
    const unreadMessages = await this.messages
      .extend(Q.where('read_at', null))
      .fetch();

    await this.database.write(async () => {
      await Promise.all(
        unreadMessages.map(msg => msg.markAsRead())
      );
      
      await this.update(chat => {
        chat.unreadCount = 0;
      });
    });
  }

  /**
   * Incrementa contador de não lidas
   */
  async incrementUnreadCount(): Promise<void> {
    await this.update(chat => {
      chat.unreadCount = chat.unreadCount + 1;
    });
  }

  /**
   * Atualiza informações da última mensagem (denormalização)
   */
  async updateLastMessage(content: string, timestamp: Date): Promise<void> {
    await this.update(chat => {
      chat.lastMessageContent = content;
      chat.lastMessageAt = timestamp;
    });
  }
}
