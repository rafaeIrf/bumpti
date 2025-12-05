-- Returns count of users who liked the viewer, but viewer hasn't liked back,
-- there is no active match between them, neither blocked the other,
-- and the viewer has not disliked the other user.

create or replace function get_pending_likes(viewer_id uuid)
returns table (
  pending_count bigint
)
language sql
stable
as $$
with likes as (
  select ui.from_user_id
  from user_interactions ui
  where ui.to_user_id = viewer_id
    and ui.action = 'like'
    and (ui.action_expires_at is null or ui.action_expires_at > now())
),
not_recip as (
  select distinct l.from_user_id as user_id
  from likes l
  where not exists (
    -- If the viewer has any interaction (like OR dislike) towards this user
    -- consider it handled and exclude from pending
    select 1 from user_interactions ui2
    where ui2.from_user_id = viewer_id
      and ui2.to_user_id = l.from_user_id
      and ui2.action in ('like', 'dislike')
      and (ui2.action_expires_at is null or ui2.action_expires_at > now())
  )
  and not exists (
    select 1 from user_matches m
    where ((m.user_a = viewer_id and m.user_b = l.from_user_id) or (m.user_b = viewer_id and m.user_a = l.from_user_id))
      and m.status in ('active', 'unmatched')
  )
  and not exists (
    select 1 from user_blocks ub
    where (ub.blocker_id = viewer_id and ub.blocked_id = l.from_user_id)
       or (ub.blocker_id = l.from_user_id and ub.blocked_id = viewer_id)
  )
)
select
  (select count(*)::bigint from not_recip) as pending_count
from not_recip limit 1;
$$;