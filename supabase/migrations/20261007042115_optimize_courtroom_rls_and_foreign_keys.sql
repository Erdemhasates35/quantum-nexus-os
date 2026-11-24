
create index if not exists idx_proceedings_case_id on public.proceedings(case_id);
create index if not exists idx_sim_decisions_created_by on public.simulation_decisions(created_by);
create index if not exists idx_sim_decisions_proceeding_id on public.simulation_decisions(proceeding_id);
create index if not exists idx_sim_sessions_created_by on public.simulation_sessions(created_by);
create index if not exists idx_sim_turns_agent_id on public.simulation_turns(agent_id);

drop policy if exists "Approved users create proceedings" on public.proceedings;
create policy "Approved users create proceedings" on public.proceedings for insert to authenticated
with check ((select private.is_approved_user()) and created_by=(select auth.uid()));

drop policy if exists "Proceeding access simulation sessions" on public.simulation_sessions;
create policy "Proceeding access simulation sessions" on public.simulation_sessions for all to authenticated
using ((select private.can_access_proceeding(proceeding_id)))
with check ((select private.can_access_proceeding(proceeding_id)) and created_by=(select auth.uid()));

drop policy if exists "Proceeding access simulation decisions" on public.simulation_decisions;
create policy "Proceeding access simulation decisions" on public.simulation_decisions for all to authenticated
using ((select private.can_access_proceeding(proceeding_id)))
with check ((select private.can_access_proceeding(proceeding_id)) and created_by=(select auth.uid()));
