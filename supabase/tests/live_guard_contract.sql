begin;
insert into nexus_private.venue_accounts(venue,account_label,environment,status)
values('contract-venue','live-guard-contract','production','disabled')
returning id;

insert into nexus_private.instruments(venue,market_type,symbol,base_asset,quote_asset,settlement_asset,price_tick,quantity_step,min_quantity,min_notional)
values('contract-venue','perpetual','CONTRACTUSDT','CONTRACT','USDT','USDT', '0.01','0.001','0.001','5')
returning id;

do $$
declare
  account_id uuid;
  instrument_id uuid;
  intent_id uuid;
begin
  select id into account_id from nexus_private.venue_accounts where venue='contract-venue' and account_label='live-guard-contract';
  select id into instrument_id from nexus_private.instruments where venue='contract-venue' and symbol='CONTRACTUSDT';
  insert into nexus_private.order_intents(
    strategy_code,account_id,instrument_id,client_order_id,idempotency_key,request_digest,
    side,order_type,quantity,requested_mode,state,metadata
  )
  values(
    'basis_funding_velocity',account_id,instrument_id,'guard-contract-client-order','guard-contract-idempotency',
    repeat('a',64),'buy','market','0.01','live','created','{}'::jsonb
  )
  returning id into intent_id;

  execute 'set local role service_role';
  begin
    perform nexus_private.consume_live_authorization(intent_id,'contract-executor',repeat('b',64));
    raise exception 'live_authorization_without_risk_verdict_was_accepted';
  exception when others then
    if sqlerrm <> 'risk_verdict_required' then raise; end if;
  end;
end
$$;
rollback;
