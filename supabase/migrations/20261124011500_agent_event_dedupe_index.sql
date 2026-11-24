create unique index if not exists agent_events_dedupe_uidx on nexus_private.agent_events(run_id,dedupe_key) where dedupe_key is not null;
