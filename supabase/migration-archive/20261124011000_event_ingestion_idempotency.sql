alter table nexus_private.order_intents add column if not exists request_digest text;
alter table nexus_private.order_intents add constraint order_intents_request_digest_check check (request_digest is null or request_digest ~ '^[0-9a-f]{64}$');
create unique index if not exists order_book_snapshots_sequence_uidx on nexus_private.order_book_snapshots(instrument_id,venue,sequence_number) where sequence_number is not null;
create unique index if not exists order_flow_events_sequence_uidx on nexus_private.order_flow_events(instrument_id,venue,event_sequence) where event_sequence is not null;
create unique index if not exists order_flow_events_trade_uidx on nexus_private.order_flow_events(instrument_id,venue,exchange_trade_id) where exchange_trade_id is not null;
