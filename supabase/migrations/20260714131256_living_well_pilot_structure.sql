-- Additive editorial structure for the Living Well pilot.
-- Existing persons/entries data stays in place; the legacy entries.person text
-- remains available while person_id becomes the stable relationship.

begin;

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Books / volumes
-- ---------------------------------------------------------------------------

create table public.books (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  subtitle text,
  thesis text not null,
  kind text not null default 'thematic',
  status text not null default 'concept',
  is_pilot boolean not null default false,
  focus_theme text,
  period_start smallint,
  period_end smallint,
  direction text,
  selection_brief jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint books_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint books_kind_valid check (kind in ('pilot', 'thematic', 'period', 'movement', 'general')),
  constraint books_status_valid check (status in ('concept', 'active', 'paused', 'published', 'archived')),
  constraint books_period_valid check (
    period_start is null or period_end is null or period_start <= period_end
  ),
  constraint books_selection_brief_object check (jsonb_typeof(selection_brief) = 'object')
);

create index books_status_sort_idx on public.books (status, sort_order, created_at);

insert into public.books (
  slug,
  title,
  subtitle,
  thesis,
  kind,
  status,
  is_pilot,
  direction,
  selection_brief
)
values (
  'living-well-pilot',
  'Living Well',
  'Menschen, die ihr Leben radikal nach einer eigenen Idee formten',
  'Living Well porträtiert Menschen, die ihr Leben radikal nach einer eigenen Idee formten – und zeigt an konkreten Szenen, was daran inspirierend, widersprüchlich und teuer war.',
  'pilot',
  'active',
  true,
  'Ein breiter, epochenübergreifender Pilotband. Auswahl nach Passung zur These und Stärke im Ensemble, nicht nach Berühmtheit allein.',
  jsonb_build_object(
    'selection_goal', '10–12 Kernfiguren für den ersten vollständigen Band',
    'editorial_lens', jsonb_build_array('inspirierend', 'widersprüchlich', 'teuer'),
    'scope', 'epochenübergreifend'
  )
);

-- ---------------------------------------------------------------------------
-- Explainable person-to-book fit
-- Six criteria intentionally use a small 0–2 scale: 0 = weak/no fit,
-- 1 = plausible, 2 = defining strength. A total is only comparable after all
-- six criteria have been reviewed.
-- ---------------------------------------------------------------------------

create table public.book_candidates (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  person_id uuid not null references public.persons(id) on delete cascade,
  stage text not null default 'pool',
  thesis_fit smallint,
  scene_potential smallint,
  resonance_value smallint,
  tension_depth smallint,
  visual_potential smallint,
  ensemble_value smallint,
  fit_score smallint generated always as (
    case
      when thesis_fit is null
        or scene_potential is null
        or resonance_value is null
        or tension_depth is null
        or visual_potential is null
        or ensemble_value is null
      then null
      else thesis_fit
        + scene_potential
        + resonance_value
        + tension_depth
        + visual_potential
        + ensemble_value
    end
  ) stored,
  fit_components_completed smallint generated always as (
    (case when thesis_fit is null then 0 else 1 end)
    + (case when scene_potential is null then 0 else 1 end)
    + (case when resonance_value is null then 0 else 1 end)
    + (case when tension_depth is null then 0 else 1 end)
    + (case when visual_potential is null then 0 else 1 end)
    + (case when ensemble_value is null then 0 else 1 end)
  ) stored,
  rationale text,
  strengths text,
  risks text,
  review_origin text not null default 'manual',
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint book_candidates_book_person_unique unique (book_id, person_id),
  constraint book_candidates_stage_valid check (
    stage in ('pool', 'pruefen', 'shortlist', 'selected', 'parked')
  ),
  constraint book_candidates_review_origin_valid check (
    review_origin in ('manual', 'ai', 'hybrid', 'import')
  ),
  constraint book_candidates_fit_range check (
    (thesis_fit is null or thesis_fit between 0 and 2)
    and (scene_potential is null or scene_potential between 0 and 2)
    and (resonance_value is null or resonance_value between 0 and 2)
    and (tension_depth is null or tension_depth between 0 and 2)
    and (visual_potential is null or visual_potential between 0 and 2)
    and (ensemble_value is null or ensemble_value between 0 and 2)
  )
);

create index book_candidates_book_stage_idx
  on public.book_candidates (book_id, stage, fit_score desc nulls last);
create index book_candidates_person_idx on public.book_candidates (person_id);

-- Keep the broad stock: every existing person starts in the active pilot pool.
insert into public.book_candidates (book_id, person_id, stage, review_origin)
select b.id, p.id, 'pool', 'manual'
from public.books b
cross join public.persons p
where b.slug = 'living-well-pilot'
on conflict (book_id, person_id) do nothing;

-- ---------------------------------------------------------------------------
-- Stable entry-to-person relationship (legacy entries.person remains intact)
-- ---------------------------------------------------------------------------

alter table public.entries
  add column person_id uuid references public.persons(id) on delete set null;

update public.entries e
set person_id = (
  select p.id
  from public.persons p
  where lower(btrim(p.name)) = lower(btrim(e.person))
  order by p.created_at nulls last, p.id
  limit 1
)
where e.person_id is null
  and exists (
    select 1
    from public.persons p
    where lower(btrim(p.name)) = lower(btrim(e.person))
  );

create index entries_person_id_idx on public.entries (person_id);

-- Quick Capture is idempotent for ordinary named candidates. The partial
-- index leaves legacy blank rows untouched while preventing double taps from
-- creating a second spelling-identical person.
create unique index persons_name_normalized_unique
  on public.persons (lower(btrim(name)))
  where name is not null and btrim(name) <> '';

-- ---------------------------------------------------------------------------
-- Name-first research intake and workflow queue
-- remember = capture only, extract = run enrichment.
-- ---------------------------------------------------------------------------

create table public.research_jobs (
  id uuid primary key default gen_random_uuid(),
  input_name text not null,
  source text not null default 'web_quick',
  mode text not null default 'remember',
  status text not null default 'captured',
  current_step text not null default 'intake',
  context text,
  source_ref text,
  person_id uuid references public.persons(id) on delete set null,
  priority smallint not null default 50,
  attempts smallint not null default 0,
  result_summary jsonb not null default '{}'::jsonb,
  last_error text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint research_jobs_input_name_present check (length(btrim(input_name)) > 0),
  constraint research_jobs_source_valid check (
    source in ('web_quick', 'manual', 'telegram', 'whatsapp', 'shortcut', 'api', 'import')
  ),
  constraint research_jobs_mode_valid check (mode in ('remember', 'extract')),
  constraint research_jobs_status_valid check (
    status in ('captured', 'queued', 'running', 'review', 'failed', 'done')
  ),
  constraint research_jobs_step_valid check (
    current_step in ('intake', 'identity', 'research', 'synthesis', 'review', 'persist', 'done')
  ),
  constraint research_jobs_priority_range check (priority between 0 and 100),
  constraint research_jobs_attempts_range check (attempts between 0 and 20),
  constraint research_jobs_result_summary_object check (jsonb_typeof(result_summary) = 'object')
);

create index research_jobs_status_created_idx
  on public.research_jobs (status, priority desc, created_at);
create index research_jobs_person_idx on public.research_jobs (person_id);
create index research_jobs_name_idx on public.research_jobs (lower(btrim(input_name)));
create unique index research_jobs_one_active_name_idx
  on public.research_jobs (lower(btrim(input_name)))
  where status in ('captured', 'queued', 'running', 'review');

-- Atomically claims exactly one queued (or genuinely stale) job. SKIP LOCKED
-- prevents two phones/tabs from paying for the same enrichment.
create function public.claim_research_job(p_job_id uuid default null)
returns setof public.research_jobs
language plpgsql
security invoker
set search_path = public
as $$
declare
  claimed public.research_jobs%rowtype;
begin
  select * into claimed
  from public.research_jobs
  where (p_job_id is null or id = p_job_id)
    and (
      status = 'queued'
      or (status = 'running' and updated_at < now() - interval '2 minutes')
    )
  order by priority desc, created_at
  for update skip locked
  limit 1;

  if not found then return; end if;

  update public.research_jobs
  set status = 'running',
      current_step = 'research',
      attempts = attempts + 1,
      started_at = coalesce(started_at, now()),
      updated_at = now()
  where id = claimed.id
  returning * into claimed;

  return next claimed;
end;
$$;

revoke all on function public.claim_research_job(uuid) from public, anon, authenticated;
grant execute on function public.claim_research_job(uuid) to anon;

create function public.set_living_well_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger books_set_updated_at before update on public.books
for each row execute function public.set_living_well_updated_at();
create trigger book_candidates_set_updated_at before update on public.book_candidates
for each row execute function public.set_living_well_updated_at();
create trigger research_jobs_set_updated_at before update on public.research_jobs
for each row execute function public.set_living_well_updated_at();

revoke all on function public.set_living_well_updated_at() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Per-call AI usage and cost ledger
-- Monetary values are stored at the precision returned by the API layer;
-- pricing is snapshotted so historical estimates remain explainable.
-- ---------------------------------------------------------------------------

create table public.ai_runs (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null default gen_random_uuid() unique,
  operation text not null,
  provider text not null default 'google',
  model text not null,
  status text not null default 'succeeded',
  prompt_tokens bigint,
  output_tokens bigint,
  thinking_tokens bigint not null default 0,
  total_tokens bigint,
  estimated_cost_usd numeric(14, 8),
  estimated_cost_eur numeric(14, 8),
  duration_ms integer,
  pricing jsonb not null default '{}'::jsonb,
  research_job_id uuid references public.research_jobs(id) on delete set null,
  person_id uuid references public.persons(id) on delete set null,
  book_id uuid references public.books(id) on delete set null,
  error_message text,
  created_at timestamptz not null default now(),
  constraint ai_runs_operation_valid check (
    operation in ('extract', 'enhance', 'workflow_research', 'workflow_synthesis', 'other')
  ),
  constraint ai_runs_status_valid check (status in ('succeeded', 'failed', 'cancelled')),
  constraint ai_runs_nonnegative_usage check (
    (prompt_tokens is null or prompt_tokens >= 0)
    and (output_tokens is null or output_tokens >= 0)
    and thinking_tokens >= 0
    and (total_tokens is null or total_tokens >= 0)
    and (estimated_cost_usd is null or estimated_cost_usd >= 0)
    and (estimated_cost_eur is null or estimated_cost_eur >= 0)
    and (duration_ms is null or duration_ms >= 0)
  ),
  constraint ai_runs_pricing_object check (jsonb_typeof(pricing) = 'object')
);

create index ai_runs_created_idx on public.ai_runs (created_at desc);
create index ai_runs_operation_created_idx on public.ai_runs (operation, created_at desc);
create index ai_runs_research_job_idx on public.ai_runs (research_job_id);

-- ---------------------------------------------------------------------------
-- Data API exposure: explicit privileges plus RLS on every new public table.
-- There is intentionally no DELETE/TRUNCATE/TRIGGER/REFERENCES grant for anon.
-- Column grants protect identifiers, generated scores, and timestamps while
-- retaining the requested passwordless editorial workflow.
-- ---------------------------------------------------------------------------

alter table public.books enable row level security;
alter table public.book_candidates enable row level security;
alter table public.research_jobs enable row level security;
alter table public.ai_runs enable row level security;

revoke all privileges on table public.books from anon, authenticated;
revoke all privileges on table public.book_candidates from anon, authenticated;
revoke all privileges on table public.research_jobs from anon, authenticated;
revoke all privileges on table public.ai_runs from anon, authenticated;

grant select on table public.books to anon;

grant select on table public.book_candidates to anon;
grant insert (
  book_id, person_id, stage, thesis_fit, scene_potential, resonance_value,
  tension_depth, visual_potential, ensemble_value, rationale, strengths, risks,
  review_origin, reviewed_at, updated_at
) on public.book_candidates to anon;
grant update (
  stage, thesis_fit, scene_potential, resonance_value, tension_depth,
  visual_potential, ensemble_value, rationale, strengths, risks,
  review_origin, reviewed_at, updated_at
) on public.book_candidates to anon;

grant select on table public.research_jobs to anon;
grant insert (
  input_name, source, mode, status, current_step, context, source_ref,
  priority, updated_at
) on public.research_jobs to anon;
grant update (
  source, mode, status, current_step, context, source_ref, person_id, priority, attempts,
  result_summary, last_error, started_at, finished_at, updated_at
) on public.research_jobs to anon;

grant select on table public.ai_runs to anon;
grant insert (
  request_id, operation, provider, model, status, prompt_tokens, output_tokens,
  thinking_tokens, total_tokens, estimated_cost_usd, estimated_cost_eur,
  duration_ms, pricing, research_job_id, person_id, book_id, error_message
) on public.ai_runs to anon;

-- Existing direct-browser writes stay functional, but broad automatic grants
-- such as DELETE/TRUNCATE are removed from the unauthenticated role.
revoke all privileges on table public.persons from anon, authenticated;
revoke all privileges on table public.entries from anon, authenticated;
revoke all privileges on table public.places from anon, authenticated;

grant select on table public.persons, public.entries, public.places to anon;
grant insert (
  name, dates, status, kategorie, tags, note, lebensprinzip, buchthese,
  archetyp, spannung, visuelles_motiv, format_eignung, kurationsnotiz
) on public.persons to anon;
grant update (
  dates, status, kategorie, tags, note, lebensprinzip, buchthese,
  archetyp, spannung, visuelles_motiv, format_eignung, kurationsnotiz
) on public.persons to anon;
grant insert (
  person, person_id, kategorie, buch, tags, preview, quote, anekdote, fakt,
  buchnotiz, quelle, staerke, quellenqualitaet, buchreife, themen, ton,
  seitenrolle, quelle_url
) on public.entries to anon;
grant update (
  person, person_id, kategorie, buch, tags, preview, quote, anekdote, fakt,
  buchnotiz, quelle, staerke, quellenqualitaet, buchreife, themen, ton,
  seitenrolle, quelle_url
) on public.entries to anon;

create policy books_anon_select
  on public.books for select to anon using (true);

create policy book_candidates_anon_select
  on public.book_candidates for select to anon using (true);
create policy book_candidates_anon_insert
  on public.book_candidates for insert to anon with check (true);
create policy book_candidates_anon_update
  on public.book_candidates for update to anon using (true) with check (true);

create policy research_jobs_anon_select
  on public.research_jobs for select to anon using (true);
create policy research_jobs_anon_insert
  on public.research_jobs for insert to anon
  with check (
    status in ('captured', 'queued')
    and current_step = 'intake'
    and person_id is null
    and attempts = 0
    and started_at is null
    and finished_at is null
  );
create policy research_jobs_anon_update
  on public.research_jobs for update to anon using (true) with check (true);

create policy ai_runs_anon_select
  on public.ai_runs for select to anon using (true);
create policy ai_runs_anon_insert
  on public.ai_runs for insert to anon with check (true);

-- Supabase is moving new projects to opt-in Data API grants. Make that intent
-- explicit here as well, so future public tables/functions are not exposed by
-- an inherited permissive default.
alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke usage, select on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

commit;
