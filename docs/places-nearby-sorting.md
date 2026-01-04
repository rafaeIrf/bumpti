# Places Nearby Sorting

This document explains how the RPC `search_places_nearby` sorts places and what each relevant field means. This helps keep UI behavior consistent with backend
ordering.

## Fields

- `dist_meters`

  - Distance between the user and the place, in meters.
  - Used directly when `sort_by = 'distance'`.

- `review_average`

  - Average rating score (typically 1-5).
  - Used when `sort_by = 'rating'`.

- `review_count`

  - Total number of ratings.
  - Used as a tie-breaker for `sort_by = 'rating'`.

- `total_checkins`

  - Total historical check-ins for the place.
  - Used when `sort_by = 'popularity'`.

- `last_activity_at`

  - Timestamp of the most recent activity at the place.
  - Used as a tie-breaker for `sort_by = 'relevance'` and `sort_by = 'popularity'`.

- `relevance_score`

  - Internal relevance score stored in `places_view`.
  - Used as a tie-breaker for `sort_by = 'relevance'`.

- `confidence`

  - Internal confidence/quality score for the place data.
  - Used as a final tie-breaker for `sort_by = 'relevance'`.

- `active_users`

  - Count of active users at the place, excluding the requesting user and
    applying relationship filters (blocks/dislikes/matches/gender preferences).
  - Used for display in the UI.

- `active_users_sort`
  - Count of active users at the place, excluding only the requesting user.
  - Used for ordering when `sort_by = 'relevance'` so active places rank higher.

## Ordering rules

### `sort_by = 'relevance'`

1. `active_users_sort` DESC
2. `last_activity_at` DESC
3. `relevance_score` DESC
4. `confidence` DESC
5. Fallback: `dist_meters` ASC, then `relevance_score` DESC

### `sort_by = 'distance'`

1. `dist_meters` ASC

### `sort_by = 'popularity'`

1. `total_checkins` DESC
2. `last_activity_at` DESC

### `sort_by = 'rating'`

1. `review_average` DESC
2. `review_count` DESC
