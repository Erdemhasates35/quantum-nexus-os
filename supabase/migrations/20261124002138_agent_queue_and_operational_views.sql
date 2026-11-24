create index if not exists backtest_runs_instrument_idx on nexus_private.backtest_runs(instrument_id);
create index if not exists backtest_runs_strategy_version_idx on nexus_private.backtest_runs(strategy_version_id);
create index if not exists market_correlations_instrument_b_idx on nexus_private.market_correlations(instrument_b);
create index if not exists model_inference_events_instrument_idx on nexus_private.model_inference_events(instrument_id);
create index if not exists model_inference_events_run_idx on nexus_private.model_inference_events(run_id);
create index if not exists strategy_metrics_account_idx on nexus_private.strategy_metrics(account_id);
create index if not exists strategy_metrics_strategy_version_idx on nexus_private.strategy_metrics(strategy_version_id);

create or replace view nexus_private.v_order_lifecycle
with (security_invoker=true)
as
select
  oi.id as intent_id,
  oi.run_id,
  oi.strategy_code,
  oi.account_id,
  oi.instrument_id,
  oi.client_order_id,
  oi.side,
  oi.order_type,
  oi.quantity as requested_quantity,
  oi.state,
  coalesce(f.filled_quantity,0::numeric) as filled_quantity,
  f.average_fill_price,
  coalesce(f.total_fees,0::numeric) as total_fees,
  e.venue_order_id,
  e.exchange_status,
  e.last_exchange_event_at,
  oi.created_at,
  oi.updated_at
from nexus_private.order_intents oi
left join lateral (
  select
    sum(fi.quantity) as filled_quantity,
    sum(fi.quantity*fi.price)/nullif(sum(fi.quantity),0) as average_fill_price,
    sum(fi.fee_amount) as total_fees
  from nexus_private.fills fi
  where fi.intent_id=oi.id
) f on true
left join lateral (
  select oe.venue_order_id,oe.exchange_status,max(oe.received_at) as last_exchange_event_at
  from nexus_private.order_events oe
  where oe.intent_id=oi.id
  group by oe.venue_order_id,oe.exchange_status
  order by max(oe.received_at) desc
  limit 1
) e on true;

create or replace view nexus_private.v_strategy_net_pnl
with (security_invoker=true)
as
select
  pl.account_id,
  sr.strategy_code,
  pl.asset,
  count(*) as ledger_entries,
  sum(pl.amount) as net_amount,
  sum(pl.amount_usd) as net_amount_usd,
  min(pl.occurred_at) as first_entry_at,
  max(pl.occurred_at) as last_entry_at
from nexus_private.pnl_ledger pl
left join nexus_private.strategy_runs sr on sr.id=pl.run_id
group by pl.account_id,sr.strategy_code,pl.asset;

create or replace view nexus_private.v_agent_fleet
with (security_invoker=true)
as
select
  ap.agent_code,
  ap.role_name,
  ap.role_group,
  ap.version,
  ap.enabled,
  ap.concurrency_limit,
  count(distinct ah.worker_id) filter (where ah.status in ('healthy','degraded')) as connected_workers,
  max(ah.last_seen_at) as last_heartbeat_at,
  count(distinct at.id) filter (where at.status in ('queued','leased','running','retry_wait')) as active_tasks,
  count(distinct at.id) filter (where at.status='dead_letter') as dead_letter_tasks
from nexus_private.agent_profiles ap
left join nexus_private.agent_heartbeats ah on ah.agent_code=ap.agent_code
left join nexus_private.agent_tasks at on at.agent_code=ap.agent_code
group by ap.agent_code,ap.role_name,ap.role_group,ap.version,ap.enabled,ap.concurrency_limit;

create or replace view nexus_private.v_open_reconciliation_discrepancies
with (security_invoker=true)
as
select
  d.id,
  d.reconciliation_id,
  r.account_id,
  r.venue,
  d.entity_type,
  d.local_reference,
  d.venue_reference,
  d.discrepancy_type,
  d.severity,
  d.local_value,
  d.venue_value,
  d.detected_at
from nexus_private.reconciliation_discrepancies d
join nexus_private.reconciliation_runs r on r.id=d.reconciliation_id
where d.resolution_status='open';

create or replace function nexus_private.claim_agent_task(
  p_agent_code text,
  p_worker_id text,
  p_lease_seconds integer default 30
)
returns setof nexus_private.agent_tasks
language plpgsql
security definer
set search_path=''
as $$
begin
  if p_lease_seconds < 5 or p_lease_seconds > 300 then
    raise exception 'lease_seconds_out_of_range';
  end if;
  if p_worker_id is null or length(p_worker_id) < 1 or length(p_worker_id) > 128 then
    raise exception 'invalid_worker_id';
  end if;
  if not exists (
    select 1 from nexus_private.agent_profiles
    where agent_code=p_agent_code and enabled=true
  ) then
    return;
  end if;
  return query
  with candidate as (
    select t.id
    from nexus_private.agent_tasks t
    where t.agent_code=p_agent_code
      and t.attempt_count < t.max_attempts
      and (
        t.status in ('queued','retry_wait')
        or (t.status='leased' and t.lease_until < pg_catalog.now())
      )
    order by t.priority desc,t.created_at asc
    for update skip locked
    limit 1
  )
  update nexus_private.agent_tasks t
  set status='leased',
      lease_owner=p_worker_id,
      lease_until=pg_catalog.now()+pg_catalog.make_interval(secs=>p_lease_seconds),
      attempt_count=t.attempt_count+1,
      started_at=coalesce(t.started_at,pg_catalog.now()),
      updated_at=pg_catalog.now()
  from candidate c
  where t.id=c.id
  returning t.*;
end;
$$;

create or replace function nexus_private.heartbeat_agent(
  p_agent_code text,
  p_worker_id text,
  p_status text,
  p_metrics jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path=''
as $$
begin
  if p_status not in ('starting','healthy','degraded','stopping','offline') then
    raise exception 'invalid_agent_status';
  end if;
  if p_worker_id is null or length(p_worker_id) < 1 or length(p_worker_id) > 128 then
    raise exception 'invalid_worker_id';
  end if;
  if not exists (
    select 1 from nexus_private.agent_profiles
    where agent_code=p_agent_code and enabled=true
  ) then
    raise exception 'agent_profile_disabled_or_missing';
  end if;
  insert into nexus_private.agent_heartbeats(agent_code,worker_id,status,last_seen_at,metrics)
  values(p_agent_code,p_worker_id,p_status,pg_catalog.now(),coalesce(p_metrics,'{}'::jsonb))
  on conflict(agent_code,worker_id) do update
  set status=excluded.status,last_seen_at=excluded.last_seen_at,metrics=excluded.metrics;
end;
$$;

create or replace function nexus_private.finish_agent_task(
  p_task_id uuid,
  p_worker_id text,
  p_status text,
  p_output jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  affected integer;
begin
  if p_status not in ('succeeded','failed','retry_wait','dead_letter','canceled') then
    raise exception 'invalid_terminal_task_status';
  end if;
  update nexus_private.agent_tasks
  set status=p_status,
      output=coalesce(p_output,'{}'::jsonb),
      lease_owner=null,
      lease_until=null,
      finished_at=case when p_status in ('succeeded','dead_letter','canceled') then pg_catalog.now() else null end,
      updated_at=pg_catalog.now()
  where id=p_task_id
    and lease_owner=p_worker_id
    and status in ('leased','running');
  get diagnostics affected=row_count;
  return affected=1;
end;
$$;

revoke all on function nexus_private.claim_agent_task(text,text,integer) from public,anon,authenticated;
revoke all on function nexus_private.heartbeat_agent(text,text,text,jsonb) from public,anon,authenticated;
revoke all on function nexus_private.finish_agent_task(uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function nexus_private.claim_agent_task(text,text,integer) to service_role;
grant execute on function nexus_private.heartbeat_agent(text,text,text,jsonb) to service_role;
grant execute on function nexus_private.finish_agent_task(uuid,text,text,jsonb) to service_role;

revoke all on nexus_private.v_order_lifecycle,nexus_private.v_strategy_net_pnl,nexus_private.v_agent_fleet,nexus_private.v_open_reconciliation_discrepancies from anon,authenticated;
grant select on nexus_private.v_order_lifecycle,nexus_private.v_strategy_net_pnl,nexus_private.v_agent_fleet,nexus_private.v_open_reconciliation_discrepancies to service_role;
