-- Replaces the single persons.image_url with a real one-to-many gallery:
-- curators collect several candidate photos per person and pick one as the
-- cover. persons.image_url stays as a denormalized cache of the current
-- cover's URL so card grids/profile headers don't need a join for the
-- common case; person_images is the source of truth.
--
-- Unlike persons/entries, this table allows anon DELETE — photo candidates
-- are disposable research material, not curated editorial content, and
-- curators need to prune bad picks freely.

create table public.person_images (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.persons(id) on delete cascade,
  url text not null,
  caption text,
  is_cover boolean not null default false,
  created_at timestamptz not null default now()
);

create index person_images_person_id_idx on public.person_images(person_id);

alter table public.person_images enable row level security;

create policy "person_images_public_select"
  on public.person_images for select
  to public
  using (true);

create policy "person_images_anon_insert"
  on public.person_images for insert
  to anon
  with check (true);

create policy "person_images_anon_update"
  on public.person_images for update
  to anon
  using (true)
  with check (true);

create policy "person_images_anon_delete"
  on public.person_images for delete
  to anon
  using (true);

-- Storage objects for removed gallery entries can also be cleaned up directly.
create policy "person_images_bucket_anon_delete"
  on storage.objects for delete
  to anon
  using (bucket_id = 'person-images');
