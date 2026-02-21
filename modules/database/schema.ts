import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const schema = appSchema({
  version: 10,
  tables: [
    // Tabela de matches
    tableSchema({
      name: 'matches',
      columns: [
        { name: 'chat_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'user_a', type: 'string', isIndexed: true },
        { name: 'user_b', type: 'string', isIndexed: true },
        { name: 'status', type: 'string' }, // 'active' | 'unmatched'
        { name: 'matched_at', type: 'number' },
        { name: 'unmatched_at', type: 'number', isOptional: true },
        { name: 'place_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'user_a_opened_at', type: 'number', isOptional: true },
        { name: 'user_b_opened_at', type: 'number', isOptional: true },
        { name: 'synced_at', type: 'number' },
        // Denormalized fields
        { name: 'other_user_id', type: 'string', isOptional: true },
        { name: 'other_user_name', type: 'string', isOptional: true },
        { name: 'other_user_photo_url', type: 'string', isOptional: true },
        { name: 'place_name', type: 'string', isOptional: true },
        { name: 'first_message_at', type: 'number', isOptional: true },
        { name: 'match_origin', type: 'string', isOptional: true },
        { name: 'match_metadata', type: 'string', isOptional: true },
      ],
    }),
    
    // Tabela de chats (denormalizada para performance)
    tableSchema({
      name: 'chats',
      columns: [
        { name: 'match_id', type: 'string', isIndexed: true },
        { name: 'created_at', type: 'number' },
        { name: 'last_message_content', type: 'string', isOptional: true },
        { name: 'last_message_at', type: 'number', isOptional: true },
        { name: 'other_user_id', type: 'string', isIndexed: true },
        { name: 'other_user_name', type: 'string', isOptional: true },
        { name: 'other_user_photo_url', type: 'string', isOptional: true },
        { name: 'place_id', type: 'string', isOptional: true },
        { name: 'place_name', type: 'string', isOptional: true },
        { name: 'unread_count', type: 'number' },
        { name: 'synced_at', type: 'number' },
      ],
    }),
    
    // Tabela de mensagens
    tableSchema({
      name: 'messages',
      columns: [
        { name: 'chat_id', type: 'string', isIndexed: true },
        { name: 'sender_id', type: 'string', isIndexed: true },
        { name: 'content', type: 'string' },
        { name: 'created_at', type: 'number', isIndexed: true },
        { name: 'read_at', type: 'number', isOptional: true },
        { name: 'status', type: 'string' }, // 'pending' | 'sent' | 'delivered' | 'read'
        { name: 'temp_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'synced_at', type: 'number' },
      ],
    }),
    
    // Tabela de perfis cacheados (Local-First)
    tableSchema({
      name: 'profiles',
      columns: [
        // ID é o user_id do Supabase
        { name: 'user_id', type: 'string', isIndexed: true },
        { name: 'raw_data', type: 'string' }, // JSON completo do perfil
        { name: 'last_fetched_at', type: 'number', isIndexed: true }, // Para invalidação de cache
        { name: 'created_at', type: 'number' },
      ],
    }),

    // Cache efêmero do feed de discovery
    tableSchema({
      name: 'discovery_profiles',
      columns: [
        { name: 'raw_data', type: 'string' },
        { name: 'place_id', type: 'string', isIndexed: true },
        { name: 'last_fetched_at', type: 'number', isIndexed: true },
        { name: 'is_dismissed', type: 'boolean', isOptional: true },
        { name: 'created_at', type: 'number' },
      ],
    }),

    // Fila local de swipes pendentes
    tableSchema({
      name: 'swipes_queue',
      columns: [
        { name: 'target_user_id', type: 'string', isIndexed: true },
        { name: 'action', type: 'string' },
        { name: 'place_id', type: 'string' },
        // Optional match_origin_override: 'regular' for frequentadores.
        // Stored here so the context survives offline queue flush.
        { name: 'context', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
      ],
    }),

    // Lista local de IDs que deram like (instant match)
    tableSchema({
      name: 'liker_ids',
      columns: [],
    }),
  ],
});
