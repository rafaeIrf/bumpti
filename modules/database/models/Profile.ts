import { Model } from '@nozbe/watermelondb';
import { date, field, readonly } from '@nozbe/watermelondb/decorators';

/**
 * Model Profile - Cache local de perfis de usuários
 * 
 * Implementa padrão Stale-While-Revalidate:
 * - Dados retornam instantaneamente do cache
 * - Atualização em background se necessário (> 24h)
 */
export default class Profile extends Model {
  static table = 'profiles';

  @field('user_id') userId!: string;
  @field('raw_data') rawData!: string; // JSON serializado do perfil completo
  @date('last_fetched_at') lastFetchedAt!: Date;
  @readonly @date('created_at') createdAt!: Date;

  /**
   * Retorna os dados do perfil parseados
   */
  get data(): any {
    try {
      return JSON.parse(this.rawData);
    } catch (error) {
      return null;
    }
  }

  /**
   * Verifica se deve fazer fetch (throttle de 5 minutos)
   * Previne chamadas excessivas quando usuário abre/fecha tela rapidamente
   */
  get shouldFetch(): boolean {
    const THROTTLE_MS = 5 * 60 * 1000; // 5 minutos
    const now = Date.now();
    return now - this.lastFetchedAt.getTime() > THROTTLE_MS;
  }

  /**
   * DEPRECATED: Mantido para compatibilidade
   * Use shouldFetch() ao invés de isStale()
   */
  get isStale(): boolean {
    return this.shouldFetch;
  }

  /**
   * Atualiza os dados do perfil com novo JSON
   */
  async updateData(newData: any): Promise<void> {
    await this.update(profile => {
      profile.rawData = JSON.stringify(newData);
      profile.lastFetchedAt = new Date();
    });
  }
}

