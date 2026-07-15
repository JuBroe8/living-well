-- One portrait/motif image per person, stored either as an uploaded file in
-- Supabase Storage or a pasted external URL — both just end up as a URL in
-- persons.image_url. Bucket policies mirror the existing anon-write model
-- (insert/select allowed, no delete/update) already used for persons/entries.

alter table public.persons add column if not exists image_url text;

insert into storage.buckets (id, name, public)
values ('person-images', 'person-images', true)
on conflict (id) do nothing;

create policy "person_images_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'person-images');

create policy "person_images_anon_insert"
  on storage.objects for insert
  to anon
  with check (bucket_id = 'person-images');
