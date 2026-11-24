
create schema nexus_private;

revoke all on schema nexus_private from public, anon, authenticated;
grant usage on schema nexus_private to service_role;

create table nexus_private.strategy_runs (
  id uuid primary key default gen_random_uuid(),
  strategy_code text not null check (strategy_code in (
    'jito_arbitrage','rent_reclaim','backrun_migration','smart_money_copy',
    'token_2022_fee','flashloan_triangular','gasless_rebalancing',
    'pda_volatility','private_orderflow','adlr_ycp'
  )),
  chain text not null check (chain in ('solana','ethereum','polygon','gnosis','other')),
  execution_mode text not null default 'observe'
    check (execution_mode in ('observe','simulate','paper','live')),
  status text not null default 'queued'
    check (status in ('queued','running','completed','failed','aborted')),
  source_commit_sha text,
  config_sha256 text,
  correlation_id uuid not null default gen_random_uuid(),
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  check (source_commit_sha is null or source_commit_sha ~ '^[0-9a-f]{7,40}$'),
  check (config_sha256 is null or config_sha256 ~ '^[0-9a-f]{64}$'),
  check (finished_at is null or started_at is null or finished_at >= started_at)
);

create table nexus_private.agents (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references nexus_private.strategy_runs(id) on delete restrict,
  agent_code text not null,
  agent_no smallint not null check (agent_no between 1 and 3),
  role_name text not null,
  status text not null default 'registered'
    check (status in ('registered','starting','running','degraded','completed','failed','stopped')),
  worker_id text,
  started_at timestamptz,
  heartbeat_at timestamptz,
  finished_at timestamptz,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (run_id, agent_no),
  unique (run_id, agent_code),
  check (finished_at is null or started_at is null or finished_at >= started_at)
);

create table nexus_private.agent_events (
  id bigint generated always as identity primary key,
  event_uid uuid not null default gen_random_uuid() unique,
  run_id uuid not null references nexus_private.strategy_runs(id) on delete restrict,
  agent_id uuid references nexus_private.agents(id) on delete restrict,
  severity text not null check (severity in ('debug','info','notice','warning','error','critical')),
  event_type text not null,
  message text not null check (length(message) <= 4000),
  payload jsonb not null default '{}'::jsonb,
  observed_at timestamptz not null default now(),
  source_commit_sha text,
  dedupe_key text
);

create table nexus_private.market_quotes (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references nexus_private.strategy_runs(id) on delete restrict,
  chain text not null check (chain in ('solana','ethereum','polygon','gnosis','other')),
  venue text not null,
  pool_address text,
  input_asset text not null,
  output_asset text not null,
  input_amount_atomic numeric(78,0) not null check (input_amount_atomic > 0),
  output_amount_atomic numeric(78,0) not null check (output_amount_atomic >= 0),
  input_decimals smallint not null check (input_decimals between 0 and 30),
  output_decimals smallint not null check (output_decimals between 0 and 30),
  observed_slot bigint,
  quote_source text not null,
  quoted_at timestamptz not null,
  valid_until timestamptz,
  response_digest text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (valid_until is null or valid_until >= quoted_at)
);

create table nexus_private.execution_attempts (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references nexus_private.strategy_runs(id) on delete restrict,
  quote_id uuid references nexus_private.market_quotes(id) on delete restrict,
  attempt_no integer not null check (attempt_no > 0),
  provider text not null check (provider in ('rpc','jito','jupiter_lend','aave','other')),
  status text not null default 'prepared'
    check (status in ('prepared','simulated','submitted','landed','failed','rejected','expired')),
  transaction_signature text,
  bundle_id text,
  recent_blockhash text,
  requested_slot bigint,
  landed_slot bigint,
  compute_units integer check (compute_units is null or compute_units >= 0),
  priority_fee_atomic numeric(78,0) not null default 0 check (priority_fee_atomic >= 0),
  bundle_tip_atomic numeric(78,0) not null default 0 check (bundle_tip_atomic >= 0),
  expected_net_profit_atomic numeric(78,0),
  profit_asset text,
  profit_decimals smallint check (profit_decimals is null or profit_decimals between 0 and 30),
  simulation_error jsonb,
  failure_code text,
  submitted_at timestamptz,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (run_id, attempt_no),
  check (confirmed_at is null or submitted_at is null or confirmed_at >= submitted_at)
);

create unique index execution_attempts_signature_uidx
  on nexus_private.execution_attempts(transaction_signature)
  where transaction_signature is not null;

create unique index execution_attempts_bundle_uidx
  on nexus_private.execution_attempts(bundle_id)
  where bundle_id is not null;

create table nexus_private.settlements (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null unique references nexus_private.execution_attempts(id) on delete restrict,
  status text not null check (status in ('pending','finalized','reverted','disputed')),
  asset text not null,
  asset_decimals smallint not null check (asset_decimals between 0 and 30),
  borrowed_atomic numeric(78,0) not null default 0 check (borrowed_atomic >= 0),
  repaid_atomic numeric(78,0) not null default 0 check (repaid_atomic >= 0),
  loan_fee_atomic numeric(78,0) not null default 0 check (loan_fee_atomic >= 0),
  gross_profit_atomic numeric(78,0) not null default 0,
  total_cost_atomic numeric(78,0) not null default 0 check (total_cost_atomic >= 0),
  net_profit_atomic numeric(78,0) not null default 0,
  finalized_slot bigint,
  transaction_signature text,
  settled_at timestamptz,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index strategy_runs_status_created_idx
  on nexus_private.strategy_runs(status, created_at desc);
create index strategy_runs_strategy_created_idx
  on nexus_private.strategy_runs(strategy_code, created_at desc);
create index agents_run_status_idx
  on nexus_private.agents(run_id, status);
create index agents_heartbeat_idx
  on nexus_private.agents(heartbeat_at desc);
create index agent_events_run_time_idx
  on nexus_private.agent_events(run_id, observed_at desc);
create index agent_events_severity_time_idx
  on nexus_private.agent_events(severity, observed_at desc);
create index market_quotes_chain_venue_time_idx
  on nexus_private.market_quotes(chain, venue, quoted_at desc);
create index execution_attempts_run_time_idx
  on nexus_private.execution_attempts(run_id, created_at desc);
create index execution_attempts_status_time_idx
  on nexus_private.execution_attempts(status, created_at desc);
create index settlements_status_time_idx
  on nexus_private.settlements(status, created_at desc);

revoke all on all tables in schema nexus_private from public, anon, authenticated;
revoke all on all sequences in schema nexus_private from public, anon, authenticated;
grant select, insert, update on all tables in schema nexus_private to service_role;
grant usage, select on all sequences in schema nexus_private to service_role;

alter default privileges for role postgres in schema nexus_private
  revoke all on tables from public, anon, authenticated;
alter default privileges for role postgres in schema nexus_private
  grant select, insert, update on tables to service_role;
alter default privileges for role postgres in schema nexus_private
  revoke all on sequences from public, anon, authenticated;
alter default privileges for role postgres in schema nexus_private
  grant usage, select on sequences to service_role;

alter table nexus_private.strategy_runs enable row level security;
alter table nexus_private.agents enable row level security;
alter table nexus_private.agent_events enable row level security;
alter table nexus_private.market_quotes enable row level security;
alter table nexus_private.execution_attempts enable row level security;
alter table nexus_private.settlements enable row level security;

create policy service_role_only on nexus_private.strategy_runs
  for all to service_role using (true) with check (true);
create policy service_role_only on nexus_private.agents
  for all to service_role using (true) with check (true);
create policy service_role_only on nexus_private.agent_events
  for all to service_role using (true) with check (true);
create policy service_role_only on nexus_private.market_quotes
  for all to service_role using (true) with check (true);
create policy service_role_only on nexus_private.execution_attempts
  for all to service_role using (true) with check (true);
create policy service_role_only on nexus_private.settlements
  for all to service_role using (true) with check (true);
