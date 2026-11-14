-- Run once in Supabase: SQL Editor → New query → paste → Run.
-- One table holds every record. Row Level Security makes each row readable and
-- writable only by the account that owns it.

create table if not exists public.records (
  id          text        not null,
  user_id     uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  kind        text        not null,
  data        jsonb       not null default '{}'::jsonb,
  deleted     boolean     not null default false,
  updated_at  timestamptz not null,
  server_at   timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists records_user_server_at on public.records (user_id, server_at);

alter table public.records enable row level security;

drop policy if exists "own records" on public.records;
create policy "own records" on public.records
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Stamp the server time on every write (used to fetch changes from other devices)
-- and keep the newest edit when two devices change the same record.
create or replace function public.records_before_write()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and old.updated_at > new.updated_at then
    return null; -- an older edit arrived late: keep the newer one
  end if;
  new.server_at := clock_timestamp();
  return new;
end $$;

drop trigger if exists records_before_write on public.records;
create trigger records_before_write
  before insert or update on public.records
  for each row execute function public.records_before_write();

grant select, insert, update on public.records to authenticated;
