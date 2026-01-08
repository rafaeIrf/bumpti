-- Create notification_settings table
create table if not exists public.notification_settings (
    user_id uuid not null primary key references auth.users(id) on delete cascade,
    favorite_places boolean default true,
    nearby_activity boolean default true,
    messages boolean default true,
    matches boolean default true,
    updated_at timestamp with time zone default now()
);

-- Enable RLS
alter table public.notification_settings enable row level security;

-- Create policies
create policy "Users can view their own notification settings"
    on public.notification_settings for select
    using (auth.uid() = user_id);

create policy "Users can update their own notification settings"
    on public.notification_settings for insert
    with check (auth.uid() = user_id);

create policy "Users can update their own notification settings update"
    on public.notification_settings for update
    using (auth.uid() = user_id);

-- Create index for performance
create index if not exists idx_notification_settings_user_id on public.notification_settings(user_id);
