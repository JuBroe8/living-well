-- RLS policies alone don't grant access — Postgres still needs the base
-- table-level GRANT for the role. Every other table's anon/authenticated
-- grants were set up outside the migration history (before this session),
-- so creating person_images via a plain CREATE TABLE didn't inherit them:
-- every anon call hit "permission denied for table person_images" despite
-- correct RLS policies. Grant explicitly so the migration history is
-- reproducible on a fresh project.
grant select, insert, update, delete on public.person_images to anon;
grant select, insert, update, delete on public.person_images to authenticated;

-- persons uses column-level grants (see project-audit.md's "Spaltenrechte"
-- note) — the earlier migration added persons.image_url but only SELECT
-- was ever granted on it, so syncing the gallery's cover cache back onto
-- persons failed the same way.
grant update (image_url) on public.persons to anon;
