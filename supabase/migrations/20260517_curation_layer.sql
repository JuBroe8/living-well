create extension if not exists pgcrypto;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'persons' and column_name = 'id'
  ) then
    alter table public.persons add column id uuid default gen_random_uuid();
  end if;
end $$;

update public.persons set id = gen_random_uuid() where id is null;
alter table public.persons alter column id set default gen_random_uuid();
alter table public.persons alter column id set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.persons'::regclass and contype = 'p'
  ) then
    alter table public.persons add constraint persons_pkey primary key (id);
  end if;
end $$;

alter table public.persons
  add column if not exists lebensprinzip text,
  add column if not exists buchthese text,
  add column if not exists archetyp text,
  add column if not exists spannung text,
  add column if not exists visuelles_motiv text,
  add column if not exists format_eignung text[] default '{}'::text[],
  add column if not exists kurationsnotiz text;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'entries' and column_name = 'id'
  ) then
    alter table public.entries add column id uuid default gen_random_uuid();
  end if;
end $$;

update public.entries set id = gen_random_uuid() where id is null;
alter table public.entries alter column id set default gen_random_uuid();
alter table public.entries alter column id set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.entries'::regclass and contype = 'p'
  ) then
    alter table public.entries add constraint entries_pkey primary key (id);
  end if;
end $$;

alter table public.entries
  add column if not exists staerke int,
  add column if not exists quellenqualitaet text default 'unbekannt',
  add column if not exists buchreife text default 'roh',
  add column if not exists themen text[] default '{}'::text[],
  add column if not exists ton text,
  add column if not exists seitenrolle text default 'unentschieden',
  add column if not exists buchnotiz text,
  add column if not exists quelle_url text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'entries_staerke_range'
  ) then
    alter table public.entries
      add constraint entries_staerke_range
      check (staerke is null or (staerke between 1 and 5));
  end if;
end $$;

create index if not exists persons_status_idx on public.persons (status);
create index if not exists persons_archetyp_idx on public.persons (archetyp);
create index if not exists entries_person_idx on public.entries (person);
create index if not exists entries_buchreife_idx on public.entries (buchreife);
create index if not exists entries_quellenqualitaet_idx on public.entries (quellenqualitaet);
