
create schema if not exists private;

create table if not exists public.proceedings (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references public.cases(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete restrict,
  title text not null,
  jurisdiction text not null default 'Türkiye',
  proceeding_type text not null default 'other' check (proceeding_type in ('criminal','civil','labor','family','commercial','administrative','tax','military','juvenile','ip','consumer','enforcement','constitutional','echr','international','other')),
  status text not null default 'draft' check (status in ('draft','active','simulated','decided','archived')),
  description text,
  legal_question text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.proceeding_participants (
  id uuid primary key default gen_random_uuid(),
  proceeding_id uuid not null references public.proceedings(id) on delete cascade,
  display_name text not null,
  role text not null check (role in ('judge','prosecutor','defendant','complainant','plaintiff','respondent','lawyer','witness','expert','institution','interpreter','other')),
  represented_party text,
  identity_reference text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.case_events (
  id uuid primary key default gen_random_uuid(),
  proceeding_id uuid not null references public.proceedings(id) on delete cascade,
  occurred_at timestamptz,
  title text not null,
  description text not null,
  fact_status text not null default 'ASSERTED' check (fact_status in ('VERIFIED','ASSERTED','INFERRED','UNKNOWN')),
  source_kind text,
  source_reference text,
  created_at timestamptz not null default now()
);

create table if not exists public.statements (
  id uuid primary key default gen_random_uuid(),
  proceeding_id uuid not null references public.proceedings(id) on delete cascade,
  speaker_name text not null,
  speaker_role text,
  statement_text text not null,
  fact_status text not null default 'ASSERTED' check (fact_status in ('VERIFIED','ASSERTED','INFERRED','UNKNOWN')),
  source_kind text,
  source_reference text,
  created_at timestamptz not null default now()
);

create table if not exists public.claims (
  id uuid primary key default gen_random_uuid(),
  proceeding_id uuid not null references public.proceedings(id) on delete cascade,
  side text not null check (side in ('prosecution','defence','claimant','respondent','complainant','other')),
  claim_text text not null,
  fact_status text not null default 'ASSERTED' check (fact_status in ('VERIFIED','ASSERTED','INFERRED','UNKNOWN')),
  created_at timestamptz not null default now()
);

create table if not exists public.defences (
  id uuid primary key default gen_random_uuid(),
  proceeding_id uuid not null references public.proceedings(id) on delete cascade,
  side text not null,
  defence_text text not null,
  fact_status text not null default 'ASSERTED' check (fact_status in ('VERIFIED','ASSERTED','INFERRED','UNKNOWN')),
  created_at timestamptz not null default now()
);

create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  proceeding_id uuid not null references public.proceedings(id) on delete cascade,
  requested_by text not null,
  request_text text not null,
  status text not null default 'open' check (status in ('open','accepted','rejected','deferred')),
  created_at timestamptz not null default now()
);

create table if not exists public.evidence_items (
  id uuid primary key default gen_random_uuid(),
  proceeding_id uuid not null references public.proceedings(id) on delete cascade,
  title text not null,
  evidence_type text not null,
  description text,
  fact_status text not null default 'UNKNOWN' check (fact_status in ('VERIFIED','ASSERTED','INFERRED','UNKNOWN')),
  source_kind text,
  source_id uuid,
  source_locator text,
  integrity_hash text,
  created_at timestamptz not null default now()
);

create table if not exists public.provenance_edges (
  id uuid primary key default gen_random_uuid(),
  proceeding_id uuid not null references public.proceedings(id) on delete cascade,
  from_type text not null,
  from_id uuid not null,
  to_type text not null,
  to_id uuid not null,
  relation text not null,
  interpretation text,
  created_at timestamptz not null default now()
);

create table if not exists public.legal_questions (
  id uuid primary key default gen_random_uuid(),
  proceeding_id uuid not null references public.proceedings(id) on delete cascade,
  question text not null,
  status text not null default 'open' check (status in ('open','answered','unresolved')),
  answer text,
  created_at timestamptz not null default now()
);

create table if not exists public.legal_rules (
  id uuid primary key default gen_random_uuid(),
  proceeding_id uuid not null references public.proceedings(id) on delete cascade,
  source_type text not null,
  citation text not null,
  title text,
  rule_text text not null,
  valid_from date,
  valid_to date,
  source_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.precedent_refs (
  id uuid primary key default gen_random_uuid(),
  proceeding_id uuid not null references public.proceedings(id) on delete cascade,
  source_table text not null,
  source_id uuid not null,
  citation text,
  relevance text,
  created_at timestamptz not null default now()
);

create table if not exists public.simulation_sessions (
  id uuid primary key default gen_random_uuid(),
  proceeding_id uuid not null references public.proceedings(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  mode text not null default 'adversarial' check (mode in ('adversarial','comparative','academic','review')),
  status text not null default 'draft' check (status in ('draft','running','completed','failed','cancelled')),
  scenario_snapshot jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.simulation_agents (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.simulation_sessions(id) on delete cascade,
  role_key text not null,
  display_name text not null,
  mandate text not null,
  methodology text not null,
  source_scope text not null,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  unique(session_id, role_key)
);

create table if not exists public.simulation_turns (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.simulation_sessions(id) on delete cascade,
  agent_id uuid not null references public.simulation_agents(id) on delete cascade,
  turn_index integer not null,
  stage text not null,
  position text not null,
  cited_sources jsonb not null default '[]'::jsonb,
  fact_assessment jsonb not null default '[]'::jsonb,
  contradiction_flags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique(session_id, turn_index)
);

create table if not exists public.simulation_decisions (
  id uuid primary key default gen_random_uuid(),
  proceeding_id uuid not null references public.proceedings(id) on delete cascade,
  session_id uuid not null references public.simulation_sessions(id) on delete cascade,
  decision_type text not null default 'simulation',
  outcome text not null,
  reasoning text not null,
  unresolved_questions jsonb not null default '[]'::jsonb,
  confidence numeric(5,4),
  is_final boolean not null default false,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists idx_proceedings_created_by on public.proceedings(created_by);
create index if not exists idx_participants_proceeding on public.proceeding_participants(proceeding_id);
create index if not exists idx_events_proceeding_time on public.case_events(proceeding_id,occurred_at);
create index if not exists idx_statements_proceeding on public.statements(proceeding_id);
create index if not exists idx_claims_proceeding on public.claims(proceeding_id);
create index if not exists idx_defences_proceeding on public.defences(proceeding_id);
create index if not exists idx_requests_proceeding on public.requests(proceeding_id);
create index if not exists idx_evidence_proceeding on public.evidence_items(proceeding_id);
create index if not exists idx_provenance_proceeding on public.provenance_edges(proceeding_id);
create index if not exists idx_questions_proceeding on public.legal_questions(proceeding_id);
create index if not exists idx_rules_proceeding on public.legal_rules(proceeding_id);
create index if not exists idx_precedents_proceeding on public.precedent_refs(proceeding_id);
create index if not exists idx_sim_sessions_proceeding on public.simulation_sessions(proceeding_id);
create index if not exists idx_sim_agents_session on public.simulation_agents(session_id);
create index if not exists idx_sim_turns_session on public.simulation_turns(session_id,turn_index);
create index if not exists idx_sim_decisions_session on public.simulation_decisions(session_id);

create or replace function private.can_access_proceeding(p_proceeding_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.proceedings p
    where p.id = p_proceeding_id
      and (p.created_by = auth.uid() or private.is_admin(auth.uid()))
  );
$$;

revoke all on function private.can_access_proceeding(uuid) from public, anon, authenticated;
grant execute on function private.can_access_proceeding(uuid) to authenticated;

alter table public.proceedings enable row level security;
alter table public.proceeding_participants enable row level security;
alter table public.case_events enable row level security;
alter table public.statements enable row level security;
alter table public.claims enable row level security;
alter table public.defences enable row level security;
alter table public.requests enable row level security;
alter table public.evidence_items enable row level security;
alter table public.provenance_edges enable row level security;
alter table public.legal_questions enable row level security;
alter table public.legal_rules enable row level security;
alter table public.precedent_refs enable row level security;
alter table public.simulation_sessions enable row level security;
alter table public.simulation_agents enable row level security;
alter table public.simulation_turns enable row level security;
alter table public.simulation_decisions enable row level security;

create policy "Approved users read own proceedings" on public.proceedings for select to authenticated using (private.can_access_proceeding(id));
create policy "Approved users create proceedings" on public.proceedings for insert to authenticated with check (private.is_approved_user() and created_by=auth.uid());
create policy "Owners and admins update proceedings" on public.proceedings for update to authenticated using (private.can_access_proceeding(id)) with check (private.can_access_proceeding(id));

create policy "Proceeding access participants" on public.proceeding_participants for all to authenticated using (private.can_access_proceeding(proceeding_id)) with check (private.can_access_proceeding(proceeding_id));
create policy "Proceeding access events" on public.case_events for all to authenticated using (private.can_access_proceeding(proceeding_id)) with check (private.can_access_proceeding(proceeding_id));
create policy "Proceeding access statements" on public.statements for all to authenticated using (private.can_access_proceeding(proceeding_id)) with check (private.can_access_proceeding(proceeding_id));
create policy "Proceeding access claims" on public.claims for all to authenticated using (private.can_access_proceeding(proceeding_id)) with check (private.can_access_proceeding(proceeding_id));
create policy "Proceeding access defences" on public.defences for all to authenticated using (private.can_access_proceeding(proceeding_id)) with check (private.can_access_proceeding(proceeding_id));
create policy "Proceeding access requests" on public.requests for all to authenticated using (private.can_access_proceeding(proceeding_id)) with check (private.can_access_proceeding(proceeding_id));
create policy "Proceeding access evidence" on public.evidence_items for all to authenticated using (private.can_access_proceeding(proceeding_id)) with check (private.can_access_proceeding(proceeding_id));
create policy "Proceeding access provenance" on public.provenance_edges for all to authenticated using (private.can_access_proceeding(proceeding_id)) with check (private.can_access_proceeding(proceeding_id));
create policy "Proceeding access questions" on public.legal_questions for all to authenticated using (private.can_access_proceeding(proceeding_id)) with check (private.can_access_proceeding(proceeding_id));
create policy "Proceeding access rules" on public.legal_rules for all to authenticated using (private.can_access_proceeding(proceeding_id)) with check (private.can_access_proceeding(proceeding_id));
create policy "Proceeding access precedents" on public.precedent_refs for all to authenticated using (private.can_access_proceeding(proceeding_id)) with check (private.can_access_proceeding(proceeding_id));

create policy "Proceeding access simulation sessions" on public.simulation_sessions for all to authenticated using (private.can_access_proceeding(proceeding_id)) with check (private.can_access_proceeding(proceeding_id) and created_by=auth.uid());
create policy "Proceeding access simulation agents" on public.simulation_agents for all to authenticated using (exists (select 1 from public.simulation_sessions s where s.id=session_id and private.can_access_proceeding(s.proceeding_id))) with check (exists (select 1 from public.simulation_sessions s where s.id=session_id and private.can_access_proceeding(s.proceeding_id)));
create policy "Proceeding access simulation turns" on public.simulation_turns for all to authenticated using (exists (select 1 from public.simulation_sessions s where s.id=session_id and private.can_access_proceeding(s.proceeding_id))) with check (exists (select 1 from public.simulation_sessions s where s.id=session_id and private.can_access_proceeding(s.proceeding_id)));
create policy "Proceeding access simulation decisions" on public.simulation_decisions for all to authenticated using (private.can_access_proceeding(proceeding_id)) with check (private.can_access_proceeding(proceeding_id) and created_by=auth.uid());
