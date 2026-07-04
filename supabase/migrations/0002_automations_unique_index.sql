-- El índice único parcial (where template_key is not null) impedía el
-- upsert por PostgREST (on_conflict no puede inferir índices parciales).
-- Un unique normal permite igualmente varios NULL (NULL <> NULL en unique),
-- así que el comportamiento no cambia y el upsert del onboarding funciona.
drop index if exists public.automations_unique_template;
create unique index automations_unique_template
  on public.automations (business_id, template_key);
