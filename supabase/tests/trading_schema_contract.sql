do $$
declare
  missing_count integer;
  actual_count integer;
begin
  select count(*) into missing_count
  from pg_tables t
  join pg_namespace n on n.nspname=t.schemaname
  where t.schemaname='nexus_private'
    and not coalesce((select c.relrowsecurity from pg_class c where c.oid=(quote_ident(t.schemaname)||'.'||quote_ident(t.tablename))::regclass),false);
  if missing_count <> 0 then raise exception 'nexus_private_rls_missing:%',missing_count; end if;

  select count(*) into missing_count
  from pg_tables t
  where t.schemaname='nexus_private'
    and not exists(select 1 from pg_policies p where p.schemaname=t.schemaname and p.tablename=t.tablename and p.policyname='service_role_only' and p.roles @> array['service_role']::name[]);
  if missing_count <> 0 then raise exception 'nexus_private_service_role_policy_missing:%',missing_count; end if;

  select count(*) into missing_count
  from pg_constraint con
  join pg_class rel on rel.oid=con.conrelid
  join pg_namespace ns on ns.oid=rel.relnamespace
  where con.contype='f' and ns.nspname='nexus_private'
    and not exists (
      select 1 from pg_index i
      where i.indrelid=con.conrelid and i.indisvalid
        and (select array_agg(k.attnum order by k.n) from unnest(i.indkey) with ordinality k(attnum,n) where k.n<=cardinality(con.conkey))=con.conkey
    );
  if missing_count <> 0 then raise exception 'nexus_private_unindexed_foreign_keys:%',missing_count; end if;

  if (select count(*) from nexus_private.strategy_catalog) <> 10 then raise exception 'strategy_catalog_seed_count_mismatch'; end if;
  if exists(select 1 from nexus_private.strategy_catalog where enabled=true or 'live'=any(supported_modes)) then raise exception 'strategy_catalog_live_enabled_before_validation'; end if;
  if (select count(*) from nexus_private.agent_profiles) <> 6 then raise exception 'agent_profile_seed_count_mismatch'; end if;
  if exists(select 1 from nexus_private.agent_profiles where enabled=true) then raise exception 'agent_profile_enabled_before_worker_deployment'; end if;
  if (select count(*) from nexus_private.discovery_hypotheses where status='proposed') <> 5 then raise exception 'discovery_hypothesis_seed_count_mismatch'; end if;

  if has_function_privilege('anon','nexus_private.claim_agent_task(text,text,integer)','EXECUTE') then raise exception 'anon_can_claim_agent_task'; end if;
  if has_function_privilege('authenticated','nexus_private.claim_agent_task(text,text,integer)','EXECUTE') then raise exception 'authenticated_can_claim_agent_task'; end if;
  if not has_function_privilege('service_role','nexus_private.claim_agent_task(text,text,integer)','EXECUTE') then raise exception 'service_role_cannot_claim_agent_task'; end if;

  if has_table_privilege('anon','nexus_private.order_intents','SELECT') or has_table_privilege('authenticated','nexus_private.order_intents','SELECT') then raise exception 'client_role_can_read_order_intents'; end if;

  if exists(select 1 from information_schema.columns where table_schema='nexus_private' and column_name ~* '(private_key|secret_key|mnemonic|seed_phrase|api_secret|password)') then raise exception 'credential_material_column_detected'; end if;

  if (select count(*) from nexus_private.strategy_runs) <> 0
     or (select count(*) from nexus_private.agents) <> 0
     or (select count(*) from nexus_private.order_intents) <> 0
     or (select count(*) from nexus_private.fills) <> 0
     or (select count(*) from nexus_private.pnl_ledger) <> 0 then
    raise exception 'unexpected_runtime_trading_rows_present';
  end if;
end
$$;

select
  'PASS' as contract_status,
  (select count(*) from pg_tables where schemaname='nexus_private') as nexus_private_tables,
  (select count(*) from nexus_private.strategy_catalog) as registered_disabled_strategies,
  (select count(*) from nexus_private.agent_profiles) as registered_disabled_agent_profiles,
  (select count(*) from nexus_private.discovery_hypotheses) as proposed_discovery_hypotheses;

do $$
declare
  missing_count integer;
begin
  select count(*) into missing_count
  from (
    select distinct p.tablename
    from pg_policies p
    where p.schemaname='public'
      and p.roles @> array['authenticated']::name[]
  ) protected
  where not exists (
    select 1 from pg_policies p
    where p.schemaname='public'
      and p.tablename=protected.tablename
      and p.policyname='permanent_users_only'
      and p.permissive='RESTRICTIVE'
  );
  if missing_count <> 0 then raise exception 'anonymous_auth_policy_guard_missing:%',missing_count; end if;

  select count(*) into missing_count
  from pg_constraint con
  join pg_class rel on rel.oid=con.conrelid
  join pg_namespace ns on ns.oid=rel.relnamespace
  where con.contype='f' and ns.nspname='nexus_private'
    and not exists (
      select 1 from pg_index i
      where i.indrelid=con.conrelid and i.indisvalid
        and (select array_agg(k.attnum order by k.n) from unnest(i.indkey) with ordinality k(attnum,n) where k.n<=cardinality(con.conkey))=con.conkey
    );
  if missing_count <> 0 then raise exception 'unindexed_nexus_foreign_keys:%',missing_count; end if;

  if not exists(select 1 from pg_views where schemaname='nexus_private' and viewname='v_order_lifecycle') then raise exception 'order_lifecycle_view_missing'; end if;
  if not exists(select 1 from pg_views where schemaname='nexus_private' and viewname='v_strategy_net_pnl') then raise exception 'strategy_pnl_view_missing'; end if;
  if not exists(select 1 from pg_views where schemaname='nexus_private' and viewname='v_agent_fleet') then raise exception 'agent_fleet_view_missing'; end if;
  if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='nexus_private' and p.proname='claim_agent_task') then raise exception 'agent_task_claim_function_missing'; end if;
end
$$;

do $$
begin
  if not exists(select 1 from information_schema.columns where table_schema='nexus_private' and table_name='order_intents' and column_name='request_digest' and data_type='text') then raise exception 'order_intent_request_digest_missing'; end if;
  if not exists(select 1 from pg_indexes where schemaname='nexus_private' and indexname='order_book_snapshots_sequence_uidx') then raise exception 'order_book_sequence_idempotency_index_missing'; end if;
  if not exists(select 1 from pg_indexes where schemaname='nexus_private' and indexname='order_flow_events_sequence_uidx') then raise exception 'order_flow_sequence_idempotency_index_missing'; end if;
  if not exists(select 1 from pg_indexes where schemaname='nexus_private' and indexname='order_flow_events_trade_uidx') then raise exception 'order_flow_trade_idempotency_index_missing'; end if;
  if not exists(select 1 from pg_indexes where schemaname='nexus_private' and indexname='agent_events_dedupe_uidx') then raise exception 'agent_event_dedupe_index_missing'; end if;
  if has_function_privilege('anon','nexus_private.heartbeat_agent(text,text,text,jsonb)','EXECUTE') then raise exception 'anon_can_heartbeat_agents'; end if;
  if has_function_privilege('authenticated','nexus_private.finish_agent_task(uuid,text,text,jsonb)','EXECUTE') then raise exception 'authenticated_can_finish_agent_tasks'; end if;
end
$$;

do $$
begin
  if not exists(select 1 from pg_tables where schemaname='nexus_private' and tablename='guard_policy_versions') then raise exception 'guard_policy_versions_missing'; end if;
  if not exists(select 1 from pg_tables where schemaname='nexus_private' and tablename='guard_approvals') then raise exception 'guard_approvals_missing'; end if;
  if not exists(select 1 from pg_tables where schemaname='nexus_private' and tablename='execution_authorizations') then raise exception 'execution_authorizations_missing'; end if;
  if not exists(select 1 from pg_tables where schemaname='nexus_private' and tablename='guard_audit_events') then raise exception 'guard_audit_events_missing'; end if;
  if has_function_privilege('anon','nexus_private.consume_live_authorization(uuid,text,text)','EXECUTE') then raise exception 'anon_can_consume_live_authorization'; end if;
  if has_function_privilege('authenticated','nexus_private.record_execution_submission(uuid,text,text,text,text)','EXECUTE') then raise exception 'authenticated_can_record_execution_submission'; end if;
  if not has_function_privilege('service_role','nexus_private.consume_live_authorization(uuid,text,text)','EXECUTE') then raise exception 'service_role_cannot_consume_live_authorization'; end if;
end
$$;
