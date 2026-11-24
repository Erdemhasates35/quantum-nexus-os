
create index if not exists agent_events_agent_id_idx
  on nexus_private.agent_events(agent_id);
create index if not exists execution_attempts_quote_id_idx
  on nexus_private.execution_attempts(quote_id);
create index if not exists market_quotes_run_id_idx
  on nexus_private.market_quotes(run_id);
