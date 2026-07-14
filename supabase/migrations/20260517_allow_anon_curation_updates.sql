do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'persons' and policyname = 'anon_update_persons'
  ) then
    create policy anon_update_persons
    on public.persons
    for update
    to anon
    using (true)
    with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'entries' and policyname = 'anon_update_entries'
  ) then
    create policy anon_update_entries
    on public.entries
    for update
    to anon
    using (true)
    with check (true);
  end if;
end $$;
