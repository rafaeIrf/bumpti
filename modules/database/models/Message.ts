import { Model } from '@nozbe/watermelondb';
import { date, field, readonly, relation } from '@nozbe/watermelondb/decorators';
import type Chat from './Chat';

export default class Message extends Model {
  static table = 'messages';
  
  static associations = {
    chats: { type: 'belongs_to' as const, key: 'chat_id' },
  };

  @field('chat_id') chatId!: string;
  @field('sender_id') senderId!: string;
  @field('content') content!: string;
  @date('created_at') createdAt!: Date;
  @date('read_at') readAt?: Date;
  @field('status') status!: 'pending' | 'sent' | 'delivered' | 'read';
  @field('temp_id') tempId?: string;
  @readonly @date('synced_at') syncedAt!: Date;

  @relation('chats', 'chat_id') chat!: Chat;

  /**
   * Marca mensagem como lida
   */
  async markAsRead(): Promise<void> {
    if (!this.readAt) {
      await this.update(message => {
        message.readAt = new Date();
        message.status = 'read';
      });
    }
  }

  /**
   * Atualiza status da mensagem
   */
  async updateStatus(newStatus: 'pending' | 'sent' | 'delivered' | 'read'): Promise<void> {
    await this.update(message => {
      message.status = newStatus;
    });
  }

  /**
   * Substitui temp_id pelo ID real quando sincronizado
   */
  async replaceTempId(realId: string, timestamp: Date): Promise<void> {
    await this.update(message => {
      // @ts-ignore - Precisa atualizar o ID da raw row
      message._raw.id = realId;
      message.tempId = undefined;
      message.status = 'sent';
      message.createdAt = timestamp;
    });
  }

  /**
   * Verifica se é mensagem do usuário atual
   */
  isFromUser(userId: string): boolean {
    return this.senderId === userId;
  }

  /**
   * Verifica se mensagem está pendente de sincronização
   */
  isPending(): boolean {
    return this.status === 'pending';
  }
}
