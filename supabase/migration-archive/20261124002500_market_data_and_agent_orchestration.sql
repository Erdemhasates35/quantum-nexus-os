create table if not exists nexus_private.market_bars (
  id uuid primary key default gen_random_uuid(),
  instrument_id uuid not null references nexus_private.instruments(id),
  interval_code text not null,
  open_time timestamptz not null,
  close_time timestamptz not null,
  open_price numeric(38,18) not null,
  high_price numeric(38,18) not null,
  low_price numeric(38,18) not null,
  close_price numeric(38,18) not null,
  base_volume numeric(38,18) not null,
  quote_volume numeric(38,18) not null default 0,
  trade_count bigint not null default 0,
  source text not null,
  observed_at timestamptz not null default now(),
  unique(instrument_id,interval_code,open_time,source),
  constraint market_bars_interval_check check (interval_code in ('1s','5s','15s','1m','3m','5m','15m','30m','1h','2h','4h','6h','12h','1d')),
  constraint market_bars_ohlc_check check (open_price > 0 and high_price >= greatest(open_price,close_price,low_price) and low_price <= least(open_price,close_price,high_price) and close_price > 0),
  constraint market_bars_volume_check check (base_volume >= 0 and quote_volume >= 0 and trade_count >= 0),
  constraint market_bars_time_check check (close_time > open_time)
);

create table if not exists nexus_private.order_book_snapshots (
  id uuid primary key default gen_random_uuid(),
  instrument_id uuid not null references nexus_private.instruments(id),
  venue text not null,
  sequence_number text,
  bids jsonb not null,
  asks jsonb not null,
  checksum text,
  depth_levels smallint not null,
  source text not null,
  observed_at timestamptz not null,
  constraint order_book_depth_check check (depth_levels between 1 and 100),
  constraint order_book_sides_check check (jsonb_typeof(bids)='array' and jsonb_typeof(asks)='array')
);

create table if not exists nexus_private.order_flow_events (
  id uuid primary key default gen_random_uuid(),
  instrument_id uuid not null references nexus_private.instruments(id),
  venue text not null,
  event_type text not null,
  side text not null,
  price numeric(38,18) not null,
  quantity numeric(38,18) not null,
  event_sequence text,
  exchange_trade_id text,
  maker boolean,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  payload_digest text,
  constraint order_flow_type_check check (event_type in ('trade','add','cancel','modify','liquidation')),
  constraint order_flow_side_check check (side in ('buy','sell')),
  constraint order_flow_values_check check (price > 0 and quantity > 0)
);

create table if not exists nexus_private.market_correlations (
  id uuid primary key default gen_random_uuid(),
  instrument_a uuid not null references nexus_private.instruments(id),
  instrument_b uuid not null references nexus_private.instruments(id),
  interval_code text not null,
  correlation numeric(12,10) not null,
  beta numeric(24,12),
  sample_count integer not null,
  window_start timestamptz not null,
  window_end timestamptz not null,
  computed_at timestamptz not null default now(),
  source_digest text,
  constraint market_correlations_pair_check check (instrument_a <> instrument_b),
  constraint market_correlations_value_check check (correlation between -1 and 1 and sample_count >= 2),
  constraint market_correlations_window_check check (window_end > window_start)
);

create table if not exists nexus_private.backtest_runs (
  id uuid primary key default gen_random_uuid(),
  strategy_code text not null references nexus_private.strategy_catalog(strategy_code),
  strategy_version_id uuid references nexus_private.strategy_versions(id),
  instrument_id uuid references nexus_private.instruments(id),
  dataset_digest text not null,
  data_start timestamptz not null,
  data_end timestamptz not null,
  fee_model jsonb not null,
  slippage_model jsonb not null,
  execution_model_version text not null,
  status text not null default 'queued',
  metrics jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  constraint backtest_runs_status_check check (status in ('queued','running','completed','failed','rejected')),
  constraint backtest_runs_window_check check (data_end > data_start),
  constraint backtest_runs_digest_check check (dataset_digest ~ '^[0-9a-f]{64}$')
);

create table if not exists nexus_private.strategy_metrics (
  id uuid primary key default gen_random_uuid(),
  strategy_code text not null references nexus_private.strategy_catalog(strategy_code),
  strategy_version_id uuid references nexus_private.strategy_versions(id),
  account_id uuid references nexus_private.venue_accounts(id),
  window_start timestamptz not null,
  window_end timestamptz not null,
  trade_count bigint not null,
  win_count bigint not null,
  gross_pnl numeric(38,18) not null,
  fees numeric(38,18) not null,
  funding_cost numeric(38,18) not null,
  slippage_cost numeric(38,18) not null,
  net_pnl numeric(38,18) not null,
  max_drawdown numeric(20,10),
  sharpe numeric(20,10),
  profit_factor numeric(20,10),
  computed_at timestamptz not null default now(),
  evidence_digest text,
  constraint strategy_metrics_window_check check (window_end > window_start),
  constraint strategy_metrics_counts_check check (trade_count >= 0 and win_count >= 0 and win_count <= trade_count),
  constraint strategy_metrics_costs_check check (fees >= 0 and funding_cost >= 0 and slippage_cost >= 0)
);

create table if not exists nexus_private.model_inference_events (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references nexus_private.model_registry(id),
  run_id uuid references nexus_private.strategy_runs(id),
  instrument_id uuid references nexus_private.instruments(id),
  inference_id text not null unique,
  feature_digest text not null,
  output jsonb not null,
  confidence numeric(12,10),
  latency_ms numeric(14,4) not null,
  observed_at timestamptz not null default now(),
  constraint model_inference_confidence_check check (confidence is null or confidence between 0 and 1),
  constraint model_inference_latency_check check (latency_ms >= 0)
);

create index if not exists agent_tasks_agent_code_idx on nexus_private.agent_tasks(agent_code);
create index if not exists agent_tasks_agent_id_idx on nexus_private.agent_tasks(agent_id);
create index if not exists agent_tasks_parent_task_idx on nexus_private.agent_tasks(parent_task_id);
create index if not exists agent_tasks_run_idx on nexus_private.agent_tasks(run_id);
create index if not exists alpha_observations_instrument_idx on nexus_private.alpha_observations(instrument_id);
create index if not exists alpha_observations_run_idx on nexus_private.alpha_observations(run_id);
create index if not exists cost_metrics_account_idx on nexus_private.cost_metrics(account_id);
create index if not exists discovery_hypotheses_strategy_idx on nexus_private.discovery_hypotheses(strategy_code);
create index if not exists execution_routes_instrument_idx on nexus_private.execution_routes(instrument_id);
create index if not exists fills_intent_idx on nexus_private.fills(intent_id);
create index if not exists fills_order_event_idx on nexus_private.fills(order_event_id);
create index if not exists order_intents_instrument_idx on nexus_private.order_intents(instrument_id);
create index if not exists order_intents_risk_decision_idx on nexus_private.order_intents(risk_decision_id);
create index if not exists order_intents_risk_profile_idx on nexus_private.order_intents(risk_profile_code);
create index if not exists order_intents_strategy_idx on nexus_private.order_intents(strategy_code);
create index if not exists order_intents_strategy_version_idx on nexus_private.order_intents(strategy_version_id);
create index if not exists pnl_ledger_fill_idx on nexus_private.pnl_ledger(fill_id);
create index if not exists pnl_ledger_intent_idx on nexus_private.pnl_ledger(intent_id);
create index if not exists position_snapshots_instrument_idx on nexus_private.position_snapshots(instrument_id);
create index if not exists reconciliation_discrepancies_reconciliation_idx on nexus_private.reconciliation_discrepancies(reconciliation_id);
create index if not exists reconciliation_runs_account_idx on nexus_private.reconciliation_runs(account_id);
create index if not exists risk_decisions_intent_idx on nexus_private.risk_decisions(intent_id);
create index if not exists risk_decisions_profile_idx on nexus_private.risk_decisions(profile_code);
create index if not exists strategy_allocations_strategy_idx on nexus_private.strategy_allocations(strategy_code);
create index if not exists market_bars_instrument_time_idx on nexus_private.market_bars(instrument_id,interval_code,open_time desc);
create index if not exists order_book_snapshots_instrument_time_idx on nexus_private.order_book_snapshots(instrument_id,observed_at desc);
create index if not exists order_flow_events_instrument_time_idx on nexus_private.order_flow_events(instrument_id,occurred_at desc);
create index if not exists market_correlations_pair_time_idx on nexus_private.market_correlations(instrument_a,instrument_b,computed_at desc);
create index if not exists backtest_runs_strategy_created_idx on nexus_private.backtest_runs(strategy_code,created_at desc);
create index if not exists strategy_metrics_strategy_window_idx on nexus_private.strategy_metrics(strategy_code,window_end desc);
create index if not exists model_inference_events_model_time_idx on nexus_private.model_inference_events(model_id,observed_at desc);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'market_bars','order_book_snapshots','order_flow_events','market_correlations',
    'backtest_runs','strategy_metrics','model_inference_events'
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

do $$
declare
  table_name text;
begin
  foreach table_name in array array['guard_intents','positions','telemetry_events']
  loop
    if not exists (
      select 1 from pg_policies
      where schemaname='public' and tablename=table_name and policyname='service_role_only'
    ) then
      execute format('create policy service_role_only on public.%I for all to service_role using (true) with check (true)', table_name);
    end if;
    execute format('revoke all on table public.%I from anon, authenticated', table_name);
    execute format('grant all on table public.%I to service_role', table_name);
  end loop;
end
$$;

insert into nexus_private.strategy_catalog(strategy_code,display_name,strategy_family,description,enabled,supported_modes)
values
('basis_funding_velocity','Basis & Funding Velocity','basis_funding','Funding-rate and basis term-structure research strategy',false,array['paper','testnet']::text[]),
('vwap_execution','VWAP Execution','execution','Volume-weighted execution scheduling and participation control',false,array['paper','testnet']::text[]),
('atr_volatility','ATR Volatility','trend','Volatility-normalized signal and risk sizing strategy',false,array['paper','testnet']::text[]),
('correlation_relative_value','Correlation Relative Value','cross_venue','Cross-instrument spread and correlation regime strategy',false,array['paper','testnet']::text[]),
('orderbook_lstm','Order Book Sequence Model','order_flow','Sequence model over order-book state and microstructure features',false,array['paper','testnet']::text[]),
('avellaneda_stoikov_mm','Inventory-Aware Market Making','market_making','Inventory-aware quote placement with adverse-selection controls',false,array['paper','testnet']::text[]),
('hawkes_toxic_flow','Hawkes Toxic Flow','order_flow','Self-exciting order-flow intensity and toxicity filter',false,array['paper','testnet']::text[]),
('cross_venue_basis','Cross-Venue Basis Arbitrage','cross_venue','Cross-venue basis and funding dislocation strategy',false,array['paper','testnet']::text[]),
('fractional_kelly_allocator','Fractional Kelly Allocator','portfolio','Risk-constrained portfolio capital allocation layer',false,array['paper','testnet']::text[]),
('event_sourced_reconciliation','Event-Sourced Reconciliation','execution','Exchange event, fills, balances and positions reconciliation',false,array['paper','testnet']::text[])
on conflict(strategy_code) do nothing;

insert into nexus_private.agent_profiles(agent_code,role_name,role_group,version,enabled,concurrency_limit,config)
values
('scout','Scout','discovery','1.0.0',false,1,'{"mandate":"market discovery and data quality"}'::jsonb),
('cartographer','Cartographer','research','1.0.0',false,1,'{"mandate":"market structure and opportunity mapping"}'::jsonb),
('judge','Judge','validation','1.0.0',false,1,'{"mandate":"evidence and strategy validation"}'::jsonb),
('guard','Guard','risk','1.0.0',false,1,'{"mandate":"pre-trade and runtime risk controls"}'::jsonb),
('executor','Executor','execution','1.0.0',false,1,'{"mandate":"approved order lifecycle execution"}'::jsonb),
('risk_engine','Risk Engine','risk','1.0.0',false,1,'{"mandate":"portfolio exposure and circuit-breaker supervision"}'::jsonb)
on conflict(agent_code) do nothing;

insert into nexus_private.discovery_hypotheses(hypothesis_code,discovery_family,hypothesis,status)
values
('funding_velocity_regime','funding_velocity','Funding velocity and cross-venue basis persistence may identify net-positive opportunities after fees, funding and slippage.','proposed'),
('liquidity_void_detection','liquidity_void','Order-book depth discontinuities may predict short-horizon execution risk and price impact.','proposed'),
('cross_strategy_synthesis','strategy_synthesis','Conditional combination of independently validated strategy signals may improve risk-adjusted portfolio returns.','proposed'),
('latency_slippage_capture','execution_efficiency','Venue-specific latency and realized slippage distributions may improve route selection net of fees.','proposed'),
('alpha_parameter_crystallization','alpha_discovery','Out-of-sample stability and cost-adjusted statistical tests may isolate robust strategy parameter regions.','proposed')
on conflict(hypothesis_code) do nothing;
