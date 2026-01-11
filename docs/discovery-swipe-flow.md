# Discovery Swipe Flow

This document describes the local-first discovery feed, swipe queue, and instant match flow.

## Overview

The feed is cached locally in WatermelonDB and filtered against local swipes and matches.
Swipes are queued locally, batched, and synced to the edge in the background.
Instant match is triggered when the user likes someone who already liked them.

## Data model (WatermelonDB)

- `discovery_profiles`
  - `id` (user_id)
  - `raw_data` (serialized profile)
  - `place_id`
  - `last_fetched_at`
- `swipes_queue`
  - `target_user_id`
  - `action` ("like" | "dislike")
  - `place_id`
  - `created_at`
- `liker_ids`
  - `id` (user_id)

## Flow diagram

```mermaid
flowchart TD
  A[User opens PlacePeople] --> B[useDiscoveryFeed]
  B --> C[WatermelonDB: discovery_profiles]
  B --> D[WatermelonDB: swipes_queue]
  B --> E[WatermelonDB: matches/chats]
  B --> F[Filter local feed]

  B --> G[fetchDiscoveryFeed]
  G --> H[Edge: get-active-users-at-place]
  H --> I[Return users + liker_ids]
  I --> J[upsert discovery_profiles]
  I --> K[upsert liker_ids]
  G --> L[cleanup stale discovery_profiles + liker_ids]

  M[User swipes Like/Dislike] --> N[queueSwipe]
  N --> O[Insert swipes_queue]
  N --> P[Remove discovery_profile immediately]

  N --> Q{Is like & in liker_ids?}
  Q -- yes --> R[Remove liker_id]
  R --> S[Show ItsMatchModal instantly]
  R --> T[FlushNow -> Edge interact-user]

  Q -- no --> U[Start 2s batch timer]
  U --> V[FlushQueuedSwipes]
  V --> W[Edge: interact-user batch]
  W --> X[Delete swipes_queue items on success]
  W --> Y{is_match?}
  Y -- yes --> Z[Show ItsMatchModal via onMatch]

  AA[App background/inactive] --> V

  AB[Realtime: user_interactions INSERT like] --> AC[attachLikerIdsRealtime]
  AC --> K
```

## Key behaviors

- **Local-first feed:** `useDiscoveryFeed` reads from `discovery_profiles` and filters any ID
  present in `swipes_queue`, `matches`, or `chats`.
- **Optimistic UX:** swipes are queued locally and the profile is removed from
  `discovery_profiles` immediately.
- **Micro-batching:** swipes are batched for 2 seconds before sending to the edge.
- **Instant match:** if a liked user exists in `liker_ids`, the modal opens immediately and the
  queue flushes in background.
- **Realtime support:** new likes arriving via `user_interactions` are inserted into `liker_ids`
  to enable instant match without a refresh.
- **Cache cleanup (24h):** stale `discovery_profiles` are removed by `last_fetched_at`. The
  `liker_ids` set is cleared if the last fetch timestamp is older than 24 hours.

## Architecture references

- Feed + cache: `hooks/use-discovery-feed.ts`, `modules/discovery/discovery-service.ts`
- Swipe queue + batching: `hooks/use-discovery-swipes.ts`, `modules/discovery/swipe-queue-service.ts`
- Liker IDs store + realtime: `modules/discovery/liker-ids-service.ts`, `modules/discovery/realtime.ts`
- Instant match UI: `components/its-match-modal.tsx`, `app/(modals)/place-people.tsx`
- Edge endpoints: `supabase/functions/get-active-users-at-place/index.ts`, `supabase/functions/interact-user/index.ts`

## Edge endpoints

- `get-active-users-at-place` returns `{ users, liker_ids }`.
- `interact-user` accepts `{ batch: [...] }` and returns per-item `is_match`.
