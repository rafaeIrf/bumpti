import { addColumns, createTable, schemaMigrations } from '@nozbe/watermelondb/Schema/migrations';

export default schemaMigrations({
  migrations: [
    {
      toVersion: 2,
      steps: [
        // Add denormalized columns to matches
        addColumns({
          table: 'matches',
          columns: [
            { name: 'other_user_id', type: 'string', isOptional: true },
            { name: 'other_user_name', type: 'string', isOptional: true },
            { name: 'other_user_photo_url', type: 'string', isOptional: true },
            { name: 'place_name', type: 'string', isOptional: true },
          ],
        }),
        // Add denormalized columns to chats
        addColumns({
          table: 'chats',
          columns: [
            { name: 'last_message_content', type: 'string', isOptional: true },
            { name: 'last_message_at', type: 'number', isOptional: true },
            { name: 'other_user_id', type: 'string', isIndexed: true }, // Index might not be supported in addColumns depending on adapter, but usually ok
            { name: 'other_user_name', type: 'string', isOptional: true },
            { name: 'other_user_photo_url', type: 'string', isOptional: true },
            { name: 'place_id', type: 'string', isOptional: true },
            { name: 'place_name', type: 'string', isOptional: true },
            { name: 'unread_count', type: 'number' },
          ],
        }),
      ],
    },
    {
      toVersion: 3,
      steps: [
        // Create profiles table for Local-First profile caching
        createTable({
          name: 'profiles',
          columns: [
            { name: 'user_id', type: 'string', isIndexed: true },
            { name: 'raw_data', type: 'string' },
            { name: 'last_fetched_at', type: 'number', isIndexed: true },
            { name: 'created_at', type: 'number' },
          ],
        }),
      ],
    },
    {
      toVersion: 4,
      steps: [
        // Add chat_id to matches table
        addColumns({
          table: 'matches',
          columns: [
            { name: 'chat_id', type: 'string', isOptional: true, isIndexed: true },
          ],
        }),
      ],
    },
    {
      toVersion: 5,
      steps: [
        // Add first_message_at to matches table (denormalized from chat)
        addColumns({
          table: 'matches',
          columns: [
            { name: 'first_message_at', type: 'number', isOptional: true },
          ],
        }),
      ],
    },
    {
      toVersion: 6,
      steps: [
        // Create discovery_profiles table for local-first feed cache
        createTable({
          name: 'discovery_profiles',
          columns: [
            { name: 'raw_data', type: 'string' },
            { name: 'place_id', type: 'string', isIndexed: true },
            { name: 'last_fetched_at', type: 'number', isIndexed: true },
            { name: 'created_at', type: 'number' },
          ],
        }),
        // Create swipes_queue table for local pending interactions
        createTable({
          name: 'swipes_queue',
          columns: [
            { name: 'target_user_id', type: 'string', isIndexed: true },
            { name: 'action', type: 'string' },
            { name: 'place_id', type: 'string' },
            { name: 'created_at', type: 'number' },
          ],
        }),
      ],
    },
    {
      toVersion: 7,
      steps: [
        // Create liker_ids table (only id)
        createTable({
          name: 'liker_ids',
          columns: [],
        }),
      ],
    },
    {
      toVersion: 8,
      steps: [
        // Add is_dismissed flag to discovery_profiles for soft dismiss
        addColumns({
          table: 'discovery_profiles',
          columns: [
            { name: 'is_dismissed', type: 'boolean', isOptional: true },
          ],
        }),
      ],
    },
    {
      toVersion: 9,
      steps: [
        // Add match_origin and match_metadata to matches table for Smart Match Header
        addColumns({
          table: 'matches',
          columns: [
            { name: 'match_origin', type: 'string', isOptional: true },
            { name: 'match_metadata', type: 'string', isOptional: true },
          ],
        }),
      ],
    },
    {
      toVersion: 10,
      steps: [
        // Add context to swipes_queue to carry match_origin_override for regulars
        // (frequentadores who appear via get_eligible_regulars_at_place)
        addColumns({
          table: 'swipes_queue',
          columns: [
            { name: 'context', type: 'string', isOptional: true },
          ],
        }),
      ],
    },
  ],
});
