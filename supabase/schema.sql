-- StudyFlow initial Supabase schema
-- Run once in Supabase Dashboard > SQL Editor > New query.
-- The browser client uses only the Publishable Key. RLS isolates every user's rows.

create table if not exists public.homework (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    record_kind text not null default 'homework' check (record_kind in ('homework', 'exam')),
    hw_name text not null check (length(trim(hw_name)) > 0),
    hw_type text not null,
    subject text not null,
    due_date date,
    test_date date,
    score numeric(8,2),
    total_score numeric(8,2),
    notes text not null default '',
    created_at timestamptz not null default now(),
    completed boolean not null default false,
    ready_to_submit boolean not null default false,
    submitted boolean not null default false,
    completed_at timestamptz,
    submitted_at timestamptz,
    constraint homework_score_nonnegative check (score is null or score >= 0),
    constraint homework_total_score_positive check (total_score is null or total_score > 0),
    constraint homework_score_within_total check (score is null or total_score is null or score <= total_score)
);

create index if not exists homework_user_id_created_at_idx
    on public.homework (user_id, created_at);

create table if not exists public.user_profiles (
    user_id uuid primary key references auth.users(id) on delete cascade,
    settings jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.homework enable row level security;
alter table public.user_profiles enable row level security;

-- Explicitly remove default API access, then grant only the operations used by the app.
revoke all on table public.homework from anon, authenticated;
revoke all on table public.user_profiles from anon, authenticated;
grant select, insert, update, delete on table public.homework to authenticated;
grant select, insert, update on table public.user_profiles to authenticated;

-- Homework: users may access only rows whose user_id matches their Auth user ID.
drop policy if exists "homework_select_own" on public.homework;
create policy "homework_select_own" on public.homework
    for select to authenticated
    using ((select auth.uid()) = user_id);

drop policy if exists "homework_insert_own" on public.homework;
create policy "homework_insert_own" on public.homework
    for insert to authenticated
    with check ((select auth.uid()) = user_id);

drop policy if exists "homework_update_own" on public.homework;
create policy "homework_update_own" on public.homework
    for update to authenticated
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);

drop policy if exists "homework_delete_own" on public.homework;
create policy "homework_delete_own" on public.homework
    for delete to authenticated
    using ((select auth.uid()) = user_id);

-- Profile settings: users may access only their own profile row.
drop policy if exists "profiles_select_own" on public.user_profiles;
create policy "profiles_select_own" on public.user_profiles
    for select to authenticated
    using ((select auth.uid()) = user_id);

drop policy if exists "profiles_insert_own" on public.user_profiles;
create policy "profiles_insert_own" on public.user_profiles
    for insert to authenticated
    with check ((select auth.uid()) = user_id);

drop policy if exists "profiles_update_own" on public.user_profiles;
create policy "profiles_update_own" on public.user_profiles
    for update to authenticated
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);

-- Create a profile automatically for every new email or anonymous Auth user.
create or replace function public.handle_new_studyflow_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.user_profiles (user_id)
    values (new.id)
    on conflict (user_id) do nothing;
    return new;
end;
$$;

drop trigger if exists on_studyflow_auth_user_created on auth.users;
create trigger on_studyflow_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_studyflow_user();

-- Add profiles for Auth users that already existed before this script was run.
insert into public.user_profiles (user_id)
select id from auth.users
on conflict (user_id) do nothing;
