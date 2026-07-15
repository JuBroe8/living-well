-- Full page-layout editor: each row is one book page, its blocks (text,
-- quote, heading, image — free-positioned, resizable, styled) stored as a
-- single JSONB array. Kept as one JSONB column rather than a normalized
-- block table on purpose: a page is always edited/saved as a whole unit,
-- there's no cross-page querying of individual blocks, and this keeps a
-- no-build vanilla-JS app from needing a block ORM layer for what is,
-- structurally, just "this page's current draft state".
--
-- Same disposable-content permission model as person_images: pages are
-- design drafts, not curated editorial text, so anon gets full CRUD.

create table public.book_pages (
  id uuid primary key default gen_random_uuid(),
  book_id uuid references public.books(id) on delete cascade,
  person_id uuid references public.persons(id) on delete set null,
  title text not null default 'Neue Seite',
  page_order integer not null default 0,
  blocks jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index book_pages_book_id_idx on public.book_pages(book_id);
create index book_pages_person_id_idx on public.book_pages(person_id);

alter table public.book_pages enable row level security;

create policy "book_pages_public_select"
  on public.book_pages for select
  to public
  using (true);

create policy "book_pages_anon_insert"
  on public.book_pages for insert
  to anon
  with check (true);

create policy "book_pages_anon_update"
  on public.book_pages for update
  to anon
  using (true)
  with check (true);

create policy "book_pages_anon_delete"
  on public.book_pages for delete
  to anon
  using (true);

grant select, insert, update, delete on public.book_pages to anon;
grant select, insert, update, delete on public.book_pages to authenticated;
