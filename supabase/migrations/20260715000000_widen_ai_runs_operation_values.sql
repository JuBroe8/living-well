-- The grounded-research split (extract.js/enhance.js) introduced new
-- sub-operations (research passes + the new expand mode) that mergeUsage()
-- can surface as the persisted operation, but ai_runs_operation_valid only
-- allowed the original coarse set — inserts for expand/research runs were
-- silently failing the check constraint.
alter table public.ai_runs drop constraint ai_runs_operation_valid;
alter table public.ai_runs add constraint ai_runs_operation_valid check (
  operation in (
    'extract', 'extract_research',
    'enhance', 'enhance_research', 'enhance_expand', 'enhance_expand_research',
    'workflow_research', 'workflow_synthesis', 'other'
  )
);
