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
