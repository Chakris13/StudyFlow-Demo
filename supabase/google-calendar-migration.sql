-- StudyFlow Google Calendar integration migration.
-- Run once in Supabase Dashboard > SQL Editor > New query.
-- Refresh tokens are AES-GCM encrypted by Supabase Edge Functions.
-- These tables are inaccessible to anon/authenticated roles; only Edge Functions
-- using the server-side Supabase secret/service-role key may access them.

alter table public.homework
    add column if not exists calendar_event_id text,
    add column if not exists calendar_event_link text,
    add column if not exists calendar_sync_error text;

create table if not exists public.google_calendar_tokens (
    user_id uuid primary key references auth.users(id) on delete cascade,
    refresh_token_ciphertext text not null,
    refresh_token_iv text not null,
    token_scope text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.google_calendar_oauth_states (
    state_hash text primary key,
    user_id uuid not null references auth.users(id) on delete cascade,
    expires_at timestamptz not null,
    created_at timestamptz not null default now()
);

create index if not exists google_calendar_oauth_states_expires_at_idx
    on public.google_calendar_oauth_states (expires_at);

alter table public.google_calendar_tokens enable row level security;
alter table public.google_calendar_oauth_states enable row level security;

revoke all on table public.google_calendar_tokens from anon, authenticated;
revoke all on table public.google_calendar_oauth_states from anon, authenticated;

grant select, insert, update, delete on table public.google_calendar_tokens to service_role;
grant select, insert, update, delete on table public.google_calendar_oauth_states to service_role;
