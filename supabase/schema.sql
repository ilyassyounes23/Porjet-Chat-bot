-- NOIR Streaming Platform — Supabase PostgreSQL Schema & Auto-Profile Trigger
-- Run this complete script in: Supabase Dashboard -> SQL Editor -> New Query

-- 1. User Profiles (linked strictly to auth.users; NEVER stores passwords)
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text,
  full_name text,
  avatar_url text,
  preferred_language text default 'en',
  autoplay_trailers boolean default true,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Safe column migration in case public.profiles existed before created_at was added
alter table public.profiles
  add column if not exists created_at timestamptz default now() not null;

alter table public.profiles enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Automatic profile synchronization trigger for Email Signup (even before email verification) and OAuth
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    email,
    full_name,
    avatar_url,
    preferred_language,
    autoplay_trailers,
    created_at,
    updated_at
  )
  values (
    new.id,
    new.email,
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
      nullif(trim(new.raw_user_meta_data->>'name'), ''),
      split_part(coalesce(new.email, 'member'), '@', 1)
    ),
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'avatar_url'), ''),
      nullif(trim(new.raw_user_meta_data->>'picture'), '')
    ),
    coalesce(nullif(trim(new.raw_user_meta_data->>'preferred_language'), ''), 'en'),
    coalesce((new.raw_user_meta_data->>'autoplay_trailers')::boolean, true),
    coalesce(new.created_at, now()),
    now()
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(nullif(excluded.full_name, ''), public.profiles.full_name),
        avatar_url = coalesce(nullif(excluded.avatar_url, ''), public.profiles.avatar_url),
        updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Backfill profiles for any auth.users created before this migration was applied
insert into public.profiles (id, email, full_name, avatar_url, created_at, updated_at)
select
  u.id,
  u.email,
  coalesce(
    nullif(trim(u.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(u.raw_user_meta_data->>'name'), ''),
    split_part(coalesce(u.email, 'member'), '@', 1)
  ),
  coalesce(
    nullif(trim(u.raw_user_meta_data->>'avatar_url'), ''),
    nullif(trim(u.raw_user_meta_data->>'picture'), '')
  ),
  coalesce(u.created_at, now()),
  now()
from auth.users u
on conflict (id) do nothing;

-- 2. Personal Watchlist
create table if not exists public.watchlists (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  movie_id text not null,
  movie_snapshot jsonb not null,
  added_at timestamptz default now(),
  unique (user_id, movie_id)
);

alter table public.watchlists enable row level security;

drop policy if exists "Users manage own watchlist" on public.watchlists;
create policy "Users manage own watchlist"
  on public.watchlists for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 3. Viewing History
create table if not exists public.viewing_history (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  movie_id text not null,
  movie_snapshot jsonb not null,
  progress_seconds integer default 0,
  duration_seconds integer default 0,
  watched_at timestamptz default now(),
  unique (user_id, movie_id)
);

alter table public.viewing_history enable row level security;

drop policy if exists "Users manage own viewing history" on public.viewing_history;
create policy "Users manage own viewing history"
  on public.viewing_history for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 4. NOIR AI Conversations, Messages, and Saved Recommendations (RLS enforced)
create table if not exists public.ai_conversations (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null default 'Untitled Screening Session',
  mode text not null default 'discovery',
  attached_movies jsonb not null default '[]'::jsonb,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.ai_conversations
  add column if not exists mode text not null default 'discovery',
  add column if not exists attached_movies jsonb not null default '[]'::jsonb;

create index if not exists idx_ai_conversations_user_updated
  on public.ai_conversations (user_id, updated_at desc);

alter table public.ai_conversations enable row level security;

drop policy if exists "Users manage own ai conversations" on public.ai_conversations;
create policy "Users manage own ai conversations"
  on public.ai_conversations for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.ai_messages (
  id uuid default gen_random_uuid() primary key,
  conversation_id uuid references public.ai_conversations(id) on delete cascade not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  movie_context jsonb,
  created_at timestamptz default now() not null
);

create index if not exists idx_ai_messages_conv_created
  on public.ai_messages (conversation_id, created_at asc);

alter table public.ai_messages enable row level security;

drop policy if exists "Users manage own ai messages" on public.ai_messages;
create policy "Users manage own ai messages"
  on public.ai_messages for all
  using (
    exists (
      select 1
      from public.ai_conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.ai_conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  );

create or replace function public.touch_ai_conversation_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.ai_conversations
  set updated_at = now()
  where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists on_ai_message_inserted on public.ai_messages;
create trigger on_ai_message_inserted
  after insert on public.ai_messages
  for each row execute procedure public.touch_ai_conversation_updated_at();

create table if not exists public.ai_saved_recommendations (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  movie_key text not null,
  card_snapshot jsonb not null,
  created_at timestamptz default now() not null,
  unique (user_id, movie_key)
);

create index if not exists idx_ai_saved_recs_user
  on public.ai_saved_recommendations (user_id, created_at desc);

alter table public.ai_saved_recommendations enable row level security;

drop policy if exists "Users manage own saved ai recommendations" on public.ai_saved_recommendations;
create policy "Users manage own saved ai recommendations"
  on public.ai_saved_recommendations for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
