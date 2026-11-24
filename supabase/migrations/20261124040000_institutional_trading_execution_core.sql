create table if not exists nexus_private.strategy_catalog (
  strategy_code text primary key,
  display_name text not null,
  strategy_family text not null,
  description text not null default '',
  enabled boolean not null default false,
  supported_modes text[] not null default array['paper','testnet']::text[],
  default_risk_profile text,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint strategy_catalog_code_check check (length(strategy_code) between 2 and 64),
  constraint strategy_catalog_family_check check (strategy_family in ('basis_funding','trend','mean_reversion','market_making','order_flow','cross_venue','portfolio','execution','discovery','other')),
  constraint strategy_catalog_modes_check check (supported_modes <@ array['paper','testnet','live']::text[])
);

create table if not exists nexus_private.strategy_versions (
  id uuid primary key default gen_random_uuid(),
  strategy_code text not null references nexus_private.strategy_catalog(strategy_code),
  version text not null,
  source_commit_sha text not null,
  config_sha256 text not null,
  parameter_schema jsonb not null default '{}'::jsonb,
  parameters jsonb not null default '{}'::jsonb,
  validation_status text not null default 'draft',
  created_at timestamptz not null default now(),
  unique(strategy_code,version),
  constraint strategy_versions_validation_check check (validation_status in ('draft','validated','approved','deprecated','rejected')),
  constraint strategy_versions_commit_check check (source_commit_sha ~ '^[0-9a-f]{7,64}$'),
  constraint strategy_versions_config_hash_check check (config_sha256 ~ '^[0-9a-f]{64}$')
);

create table if not exists nexus_private.risk_profiles (
  profile_code text primary key,
  max_risk_per_trade numeric(20,10) not null,
  max_daily_loss numeric(20,10) not null,
  max_drawdown numeric(20,10) not null,
  max_leverage numeric(12,4) not null,
  max_open_orders integer not null,
  max_position_notional numeric(30,10) not null,
  max_slippage_bps numeric(12,4) not null,
  max_fee_bps numeric(12,4) not null,
  max_funding_bps numeric(12,4) not null,
  max_concentration numeric(12,8) not null default 1,
  enabled boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint risk_profiles_positive_check check (
    max_risk_per_trade > 0 and max_daily_loss > 0 and max_drawdown > 0 and
    max_leverage >= 1 and max_open_orders > 0 and max_position_notional > 0 and
    max_slippage_bps >= 0 and max_fee_bps >= 0 and max_funding_bps >= 0 and
    max_concentration > 0 and max_concentration <= 1
  )
);

create table if not exists nexus_private.venue_accounts (
  id uuid primary key default gen_random_uuid(),
  venue text not null,
  account_label text not null,
  environment text not null,
  account_type text not null default 'unified',
  credential_ref text,
  status text not null default 'disabled',
  capabilities jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(venue,account_label,environment),
  constraint venue_accounts_environment_check check (environment in ('production','testnet')),
  constraint venue_accounts_status_check check (status in ('disabled','read_only','armed','degraded','suspended')),
  constraint venue_accounts_credential_ref_check check (credential_ref is null or (length(credential_ref) between 1 and 256 and credential_ref !~* '(secret|private.?key|seed|mnemonic|token=|password)'))
);

create table if not exists nexus_private.instruments (
  id uuid primary key default gen_random_uuid(),
  venue text not null,
  market_type text not null,
  symbol text not null,
  base_asset text not null,
  quote_asset text not null,
  settlement_asset text,
  price_tick numeric(38,18) not null,
  quantity_step numeric(38,18) not null,
  min_quantity numeric(38,18) not null,
  min_notional numeric(38,18) not null default 0,
  contract_multiplier numeric(38,18) not null default 1,
  maker_fee_bps numeric(12,6),
  taker_fee_bps numeric(12,6),
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  observed_at timestamptz not null default now(),
  unique(venue,market_type,symbol),
  constraint instruments_market_type_check check (market_type in ('spot','perpetual','future','option','swap')),
  constraint instruments_tick_check check (price_tick > 0 and quantity_step > 0 and min_quantity >= 0 and min_notional >= 0 and contract_multiplier > 0),
  constraint instruments_fees_check check ((maker_fee_bps is null or maker_fee_bps >= 0) and (taker_fee_bps is null or taker_fee_bps >= 0))
);

create table if not exists nexus_private.funding_observations (
  id uuid primary key default gen_random_uuid(),
  instrument_id uuid not null references nexus_private.instruments(id),
  funding_rate numeric(24,16) not null,
  mark_price numeric(38,18),
  index_price numeric(38,18),
  next_funding_at timestamptz,
  observed_at timestamptz not null,
  source text not null,
  metadata jsonb not null default '{}'::jsonb,
  unique(instrument_id,source,observed_at),
  constraint funding_observations_prices_check check ((mark_price is null or mark_price > 0) and (index_price is null or index_price > 0))
);

create table if not exists nexus_private.order_intents (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references nexus_private.strategy_runs(id),
  strategy_code text not null references nexus_private.strategy_catalog(strategy_code),
  strategy_version_id uuid references nexus_private.strategy_versions(id),
  account_id uuid not null references nexus_private.venue_accounts(id),
  instrument_id uuid not null references nexus_private.instruments(id),
  client_order_id text not null,
  idempotency_key text not null,
  side text not null,
  position_side text,
  order_type text not null,
  time_in_force text,
  quantity numeric(38,18) not null,
  limit_price numeric(38,18),
  stop_price numeric(38,18),
  reduce_only boolean not null default false,
  post_only boolean not null default false,
  state text not null default 'created',
  risk_profile_code text references nexus_private.risk_profiles(profile_code),
  risk_decision_id uuid,
  requested_mode text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(account_id,client_order_id),
  unique(account_id,idempotency_key),
  constraint order_intents_side_check check (side in ('buy','sell')),
  constraint order_intents_position_side_check check (position_side is null or position_side in ('long','short','net')),
  constraint order_intents_type_check check (order_type in ('market','limit','stop_market','stop_limit','take_profit_market','take_profit_limit','trailing_stop')),
  constraint order_intents_quantity_check check (quantity > 0),
  constraint order_intents_price_check check ((limit_price is null or limit_price > 0) and (stop_price is null or stop_price > 0)),
  constraint order_intents_state_check check (state in ('created','risk_rejected','approved','submitting','accepted','partially_filled','filled','cancel_pending','canceled','rejected','expired','unknown','reconciled')),
  constraint order_intents_mode_check check (requested_mode in ('paper','testnet','live'))
);

create table if not exists nexus_private.risk_decisions (
  id uuid primary key default gen_random_uuid(),
  intent_id uuid not null references nexus_private.order_intents(id),
  profile_code text references nexus_private.risk_profiles(profile_code),
  decision text not null,
  reason_code text not null,
  explanation text not null default '',
  metrics jsonb not null default '{}'::jsonb,
  checked_at timestamptz not null default now(),
  constraint risk_decisions_decision_check check (decision in ('allow','deny','reduce','defer'))
);

alter table nexus_private.order_intents
  add constraint order_intents_risk_decision_fk
  foreign key (risk_decision_id) references nexus_private.risk_decisions(id);

create table if not exists nexus_private.order_events (
  id uuid primary key default gen_random_uuid(),
  intent_id uuid not null references nexus_private.order_intents(id),
  venue_order_id text,
  event_uid text not null,
  event_type text not null,
  exchange_status text,
  cumulative_quantity numeric(38,18),
  last_fill_quantity numeric(38,18),
  average_fill_price numeric(38,18),
  exchange_timestamp timestamptz,
  received_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb,
  unique(event_uid),
  constraint order_events_quantities_check check ((cumulative_quantity is null or cumulative_quantity >= 0) and (last_fill_quantity is null or last_fill_quantity >= 0) and (average_fill_price is null or average_fill_price > 0))
);

create table if not exists nexus_private.fills (
  id uuid primary key default gen_random_uuid(),
  intent_id uuid not null references nexus_private.order_intents(id),
  order_event_id uuid references nexus_private.order_events(id),
  account_id uuid not null references nexus_private.venue_accounts(id),
  instrument_id uuid not null references nexus_private.instruments(id),
  venue_trade_id text not null,
  side text not null,
  quantity numeric(38,18) not null,
  price numeric(38,18) not null,
  fee_amount numeric(38,18) not null default 0,
  fee_asset text not null,
  liquidity_role text,
  executed_at timestamptz not null,
  source text not null,
  raw_digest text,
  created_at timestamptz not null default now(),
  unique(account_id,venue_trade_id),
  constraint fills_side_check check (side in ('buy','sell')),
  constraint fills_quantity_check check (quantity > 0 and price > 0 and fee_amount >= 0),
  constraint fills_liquidity_check check (liquidity_role is null or liquidity_role in ('maker','taker','unknown'))
);

create table if not exists nexus_private.position_snapshots (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references nexus_private.venue_accounts(id),
  instrument_id uuid not null references nexus_private.instruments(id),
  position_side text not null,
  quantity numeric(38,18) not null,
  entry_price numeric(38,18),
  mark_price numeric(38,18),
  liquidation_price numeric(38,18),
  leverage numeric(12,4),
  initial_margin numeric(38,18),
  maintenance_margin numeric(38,18),
  realized_pnl numeric(38,18),
  unrealized_pnl numeric(38,18),
  observed_at timestamptz not null,
  source text not null,
  metadata jsonb not null default '{}'::jsonb,
  constraint position_snapshots_side_check check (position_side in ('long','short','net')),
  constraint position_snapshots_leverage_check check (leverage is null or leverage > 0)
);

create table if not exists nexus_private.balance_snapshots (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references nexus_private.venue_accounts(id),
  asset text not null,
  wallet_balance numeric(38,18) not null,
  available_balance numeric(38,18) not null,
  locked_balance numeric(38,18) not null default 0,
  unrealized_pnl numeric(38,18) not null default 0,
  observed_at timestamptz not null,
  source text not null,
  metadata jsonb not null default '{}'::jsonb,
  constraint balance_snapshots_nonnegative_check check (wallet_balance >= 0 and available_balance >= 0 and locked_balance >= 0)
);

create table if not exists nexus_private.pnl_ledger (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references nexus_private.venue_accounts(id),
  run_id uuid references nexus_private.strategy_runs(id),
  intent_id uuid references nexus_private.order_intents(id),
  fill_id uuid references nexus_private.fills(id),
  entry_type text not null,
  asset text not null,
  amount numeric(38,18) not null,
  usd_conversion_rate numeric(38,18),
  amount_usd numeric(38,18),
  source_reference text not null,
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique(account_id,source_reference,entry_type),
  constraint pnl_ledger_type_check check (entry_type in ('realized_pnl','fee','funding','rebate','borrow_interest','gas','slippage','transfer','adjustment')),
  constraint pnl_ledger_conversion_check check ((usd_conversion_rate is null or usd_conversion_rate > 0) and (amount_usd is null or usd_conversion_rate is not null))
);

create table if not exists nexus_private.reconciliation_runs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references nexus_private.venue_accounts(id),
  venue text not null,
  status text not null default 'running',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  cursor jsonb not null default '{}'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  constraint reconciliation_runs_status_check check (status in ('running','completed','partial','failed')),
  constraint reconciliation_runs_time_check check (finished_at is null or finished_at >= started_at)
);

create table if not exists nexus_private.reconciliation_discrepancies (
  id uuid primary key default gen_random_uuid(),
  reconciliation_id uuid not null references nexus_private.reconciliation_runs(id),
  entity_type text not null,
  local_reference text,
  venue_reference text,
  discrepancy_type text not null,
  severity text not null default 'warning',
  local_value jsonb,
  venue_value jsonb,
  resolution_status text not null default 'open',
  resolution_note text,
  detected_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint reconciliation_discrepancies_severity_check check (severity in ('info','warning','critical')),
  constraint reconciliation_discrepancies_resolution_check check (resolution_status in ('open','investigating','resolved','accepted'))
);

create table if not exists nexus_private.agent_profiles (
  agent_code text primary key,
  role_name text not null,
  role_group text not null,
  version text not null,
  enabled boolean not null default true,
  concurrency_limit integer not null default 1,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agent_profiles_concurrency_check check (concurrency_limit > 0)
);

create table if not exists nexus_private.agent_tasks (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references nexus_private.strategy_runs(id),
  agent_id uuid references nexus_private.agents(id),
  agent_code text not null references nexus_private.agent_profiles(agent_code),
  parent_task_id uuid references nexus_private.agent_tasks(id),
  task_type text not null,
  priority smallint not null default 50,
  status text not null default 'queued',
  idempotency_key text not null unique,
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  attempt_count integer not null default 0,
  max_attempts integer not null default 3,
  lease_owner text,
  lease_until timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agent_tasks_priority_check check (priority between 0 and 100),
  constraint agent_tasks_attempts_check check (attempt_count >= 0 and max_attempts between 1 and 20),
  constraint agent_tasks_status_check check (status in ('queued','leased','running','succeeded','failed','retry_wait','canceled','dead_letter'))
);

create table if not exists nexus_private.agent_heartbeats (
  agent_code text not null references nexus_private.agent_profiles(agent_code),
  worker_id text not null,
  status text not null,
  last_seen_at timestamptz not null,
  metrics jsonb not null default '{}'::jsonb,
  PRIMARY KEY(agent_code,worker_id),
  constraint agent_heartbeats_status_check check (status in ('starting','healthy','degraded','stopping','offline'))
);

create table if not exists nexus_private.alpha_observations (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references nexus_private.strategy_runs(id),
  strategy_code text references nexus_private.strategy_catalog(strategy_code),
  instrument_id uuid references nexus_private.instruments(id),
  signal_family text not null,
  horizon_seconds integer not null,
  signal_value numeric(38,18) not null,
  confidence numeric(12,10),
  expected_edge_bps numeric(20,10),
  realized_edge_bps numeric(20,10),
  evidence jsonb not null default '{}'::jsonb,
  observed_at timestamptz not null,
  constraint alpha_observations_horizon_check check (horizon_seconds > 0),
  constraint alpha_observations_confidence_check check (confidence is null or confidence between 0 and 1)
);

create table if not exists nexus_private.strategy_allocations (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references nexus_private.venue_accounts(id),
  strategy_code text not null references nexus_private.strategy_catalog(strategy_code),
  target_weight numeric(12,10) not null,
  max_notional numeric(38,18) not null,
  enabled boolean not null default false,
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  unique(account_id,strategy_code,valid_from),
  constraint strategy_allocations_weight_check check (target_weight >= 0 and target_weight <= 1),
  constraint strategy_allocations_notional_check check (max_notional > 0),
  constraint strategy_allocations_window_check check (valid_until is null or valid_until > valid_from)
);

create table if not exists nexus_private.venue_health (
  id uuid primary key default gen_random_uuid(),
  venue text not null,
  environment text not null,
  market_type text not null,
  status text not null,
  latency_ms numeric(14,4),
  rate_limit_remaining integer,
  observed_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint venue_health_environment_check check (environment in ('production','testnet')),
  constraint venue_health_status_check check (status in ('healthy','degraded','unavailable','rate_limited','maintenance')),
  constraint venue_health_latency_check check (latency_ms is null or latency_ms >= 0)
);

create table if not exists nexus_private.cost_metrics (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references nexus_private.strategy_runs(id),
  account_id uuid references nexus_private.venue_accounts(id),
  cost_type text not null,
  asset text not null,
  amount numeric(38,18) not null,
  usd_conversion_rate numeric(38,18),
  amount_usd numeric(38,18),
  source_reference text not null,
  occurred_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb,
  unique(source_reference,cost_type),
  constraint cost_metrics_amount_check check (amount >= 0),
  constraint cost_metrics_conversion_check check ((usd_conversion_rate is null or usd_conversion_rate > 0) and (amount_usd is null or usd_conversion_rate is not null))
);

create table if not exists nexus_private.circuit_breakers (
  id uuid primary key default gen_random_uuid(),
  scope text not null,
  scope_key text not null,
  state text not null default 'closed',
  trigger_code text,
  threshold jsonb not null default '{}'::jsonb,
  observed_metrics jsonb not null default '{}'::jsonb,
  opened_at timestamptz,
  reset_after timestamptz,
  updated_at timestamptz not null default now(),
  unique(scope,scope_key),
  constraint circuit_breakers_scope_check check (scope in ('global','venue','account','strategy','instrument')),
  constraint circuit_breakers_state_check check (state in ('closed','open','half_open'))
);

create table if not exists nexus_private.execution_routes (
  id uuid primary key default gen_random_uuid(),
  route_code text not null unique,
  instrument_id uuid not null references nexus_private.instruments(id),
  source_venue text not null,
  destination_venue text not null,
  estimated_fee_bps numeric(12,6) not null,
  estimated_slippage_bps numeric(12,6) not null,
  estimated_latency_ms numeric(14,4) not null,
  enabled boolean not null default false,
  constraints jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint execution_routes_costs_check check (estimated_fee_bps >= 0 and estimated_slippage_bps >= 0 and estimated_latency_ms >= 0),
  constraint execution_routes_venues_check check (source_venue <> destination_venue)
);

create table if not exists nexus_private.model_registry (
  id uuid primary key default gen_random_uuid(),
  model_code text not null,
  version text not null,
  artifact_digest text not null,
  feature_schema jsonb not null,
  training_window_start timestamptz,
  training_window_end timestamptz,
  validation_metrics jsonb not null default '{}'::jsonb,
  status text not null default 'candidate',
  created_at timestamptz not null default now(),
  unique(model_code,version),
  constraint model_registry_digest_check check (artifact_digest ~ '^[0-9a-f]{64}$'),
  constraint model_registry_status_check check (status in ('candidate','validated','approved','deployed','retired','rejected')),
  constraint model_registry_window_check check (training_window_end is null or training_window_start is null or training_window_end > training_window_start)
);

create table if not exists nexus_private.discovery_hypotheses (
  id uuid primary key default gen_random_uuid(),
  hypothesis_code text not null unique,
  strategy_code text references nexus_private.strategy_catalog(strategy_code),
  discovery_family text not null,
  hypothesis text not null,
  expected_edge_bps numeric(20,10),
  observed_edge_bps numeric(20,10),
  sample_size bigint not null default 0,
  acceptance_criteria jsonb not null default '{}'::jsonb,
  evidence jsonb not null default '{}'::jsonb,
  status text not null default 'proposed',
  created_at timestamptz not null default now(),
  evaluated_at timestamptz,
  constraint discovery_hypotheses_sample_check check (sample_size >= 0),
  constraint discovery_hypotheses_status_check check (status in ('proposed','collecting','validated','rejected','promoted','retired'))
);

create index if not exists strategy_versions_strategy_created_idx on nexus_private.strategy_versions(strategy_code,created_at desc);
create index if not exists funding_observations_instrument_time_idx on nexus_private.funding_observations(instrument_id,observed_at desc);
create index if not exists order_intents_state_created_idx on nexus_private.order_intents(state,created_at desc);
create index if not exists order_intents_run_created_idx on nexus_private.order_intents(run_id,created_at desc);
create index if not exists order_events_intent_time_idx on nexus_private.order_events(intent_id,received_at desc);
create index if not exists fills_account_time_idx on nexus_private.fills(account_id,executed_at desc);
create index if not exists fills_instrument_time_idx on nexus_private.fills(instrument_id,executed_at desc);
create index if not exists position_snapshots_account_time_idx on nexus_private.position_snapshots(account_id,observed_at desc);
create index if not exists balance_snapshots_account_asset_time_idx on nexus_private.balance_snapshots(account_id,asset,observed_at desc);
create index if not exists pnl_ledger_account_time_idx on nexus_private.pnl_ledger(account_id,occurred_at desc);
create index if not exists pnl_ledger_run_time_idx on nexus_private.pnl_ledger(run_id,occurred_at desc);
create index if not exists reconciliation_discrepancies_open_idx on nexus_private.reconciliation_discrepancies(severity,detected_at desc) where resolution_status='open';
create index if not exists agent_tasks_queue_idx on nexus_private.agent_tasks(priority desc,created_at) where status in ('queued','retry_wait');
create index if not exists agent_tasks_lease_idx on nexus_private.agent_tasks(lease_until) where status='leased';
create index if not exists agent_heartbeats_seen_idx on nexus_private.agent_heartbeats(last_seen_at desc);
create index if not exists alpha_observations_strategy_time_idx on nexus_private.alpha_observations(strategy_code,observed_at desc);
create index if not exists venue_health_venue_time_idx on nexus_private.venue_health(venue,environment,observed_at desc);
create index if not exists cost_metrics_run_time_idx on nexus_private.cost_metrics(run_id,occurred_at desc);
create index if not exists discovery_hypotheses_status_idx on nexus_private.discovery_hypotheses(status,created_at desc);

alter table nexus_private.agents drop constraint if exists agents_agent_no_check;
alter table nexus_private.agents add constraint agents_agent_no_check check (agent_no between 1 and 64);

alter table nexus_private.execution_attempts drop constraint if exists execution_attempts_provider_check;
alter table nexus_private.execution_attempts add constraint execution_attempts_provider_check check (provider in ('rpc','jito','jupiter_lend','aave','binance','bybit','okx','bitget','coinbase','kraken','hyperliquid','dydx','other'));

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'strategy_catalog','strategy_versions','risk_profiles','venue_accounts','instruments',
    'funding_observations','order_intents','risk_decisions','order_events','fills',
    'position_snapshots','balance_snapshots','pnl_ledger','reconciliation_runs',
    'reconciliation_discrepancies','agent_profiles','agent_tasks','agent_heartbeats',
    'alpha_observations','strategy_allocations','venue_health','cost_metrics',
    'circuit_breakers','execution_routes','model_registry','discovery_hypotheses'
  ]
  loop
    execute format('alter table nexus_private.%I enable row level security', table_name);
    execute format('revoke all on table nexus_private.%I from anon, authenticated', table_name);
    execute format('grant all on table nexus_private.%I to service_role', table_name);
    if not exists (
      select 1 from pg_policies
      where schemaname='nexus_private' and tablename=table_name and policyname='service_role_only'
    ) then
      execute format('create policy service_role_only on nexus_private.%I for all to service_role using (true) with check (true)', table_name);
    end if;
  end loop;
end
$$;

grant usage on schema nexus_private to service_role;
