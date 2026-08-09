-- Spud Survivors: account storage.
--
-- Run this ONCE in the Supabase SQL editor (SQL Editor -> New query -> paste -> Run).
--
-- Two tables:
--   profiles  - one row per account, holding that player's achievements and compendium.
--   runs      - one row per completed run, for personal history and future leaderboards.
--
-- SECURITY MODEL: the publishable key ships inside the game, so anyone can read it and call
-- this API directly. What actually protects players is Row Level Security: every policy
-- below compares auth.uid() (the id baked into the caller's signed login token, which the
-- client cannot forge) against the row's user_id. Without RLS enabled, the publishable key
-- would let anyone read or overwrite everyone's data.

-- ---------------------------------------------------------------------------------------
-- profiles: the account's saved progress
-- ---------------------------------------------------------------------------------------
create table if not exists public.profiles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  username     text unique,
  achievements jsonb not null default '{}'::jsonb,
  compendium   jsonb not null default '{}'::jsonb,
  updated_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Each policy is scoped to the logged-in user's own row. `to authenticated` keeps logged-out
-- callers (holding only the publishable key) out entirely.
drop policy if exists "read own profile" on public.profiles;
create policy "read own profile"
  on public.profiles for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "create own profile" on public.profiles;
create policy "create own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = user_id);

-- `with check` as well as `using`: without it a player could pass the row-ownership test on
-- read and then rewrite user_id to point at somebody else's row.
drop policy if exists "update own profile" on public.profiles;
create policy "update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------------------
-- runs: one row per finished run
-- ---------------------------------------------------------------------------------------
create table if not exists public.runs (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  character  text,
  wave       integer not null default 1,
  kills      integer not null default 0,
  scrap      integer not null default 0,
  time_played real not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists runs_user_created_idx on public.runs (user_id, created_at desc);
-- Supports a future leaderboard ("best waves reached") without a table scan.
create index if not exists runs_wave_idx on public.runs (wave desc);

alter table public.runs enable row level security;

drop policy if exists "read own runs" on public.runs;
create policy "read own runs"
  on public.runs for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "insert own runs" on public.runs;
create policy "insert own runs"
  on public.runs for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Deliberately NO update or delete policy on runs: a finished run is a historical record.
-- Nothing in the game edits one, so granting the permission would only widen the attack
-- surface. Deleting the account still removes them, via the on delete cascade above.

-- ---------------------------------------------------------------------------------------
-- Auto-create a profile row the moment someone signs up, so the game never has to handle
-- "logged in but has no profile yet".
-- ---------------------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, username)
  values (new.id, split_part(new.email, '@', 1))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
