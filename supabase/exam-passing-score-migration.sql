-- Add an optional passing threshold to exam records.
alter table public.homework
add column if not exists passing_score numeric(8,2);

alter table public.homework
drop constraint if exists homework_passing_score_nonnegative;

alter table public.homework
add constraint homework_passing_score_nonnegative
check (passing_score is null or passing_score >= 0);
