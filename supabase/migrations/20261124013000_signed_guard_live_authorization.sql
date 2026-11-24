create table if not exists nexus_private.guard_policy_versions (
  policy_version text primary key,
  policy_sha256 text not null,
  policy_document jsonb not null,
  status text not null default 'draft',
  signer_key_id text not null,
  effective_at timestamptz,
  retired_at timestamptz,
  created_at timestamptz not null default now(),
  constraint guard_policy_digest_check check (policy_sha256 ~ '^[0-9a-f]{64}$'),
  constraint guard_policy_status_check check (status in ('draft','active','retired','revoked')),
  constraint guard_policy_window_check check (retired_at is null or effective_at is null or retired_at > effective_at)
);

create table if not exists nexus_private.guard_approvals (
  id uuid primary key default gen_random_uuid(),
  intent_id uuid not null unique references nexus_private.order_intents(id),
  policy_version text not null references nexus_private.guard_policy_versions(policy_version),
  decision text not null,
  reason_code text not null,
  intent_digest text not null,
  approval_digest text not null unique,
  signer_key_id text not null,
  signature_algorithm text not null,
  signature text not null,
  nonce text not null unique,
  issued_at timestamptz not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  consumed_by text,
  evidence jsonb not null default '{}'::jsonb,
  constraint guard_approval_decision_check check (decision in ('allow','deny')),
  constraint guard_approval_intent_digest_check check (intent_digest ~ '^[0-9a-f]{64}$'),
  constraint guard_approval_digest_check check (approval_digest ~ '^[0-9a-f]{64}$'),
  constraint guard_approval_signature_check check (signature_algorithm in ('ed25519','ecdsa-p256-sha256') and length(signature) between 32 and 2048),
  constraint guard_approval_time_check check (expires_at > issued_at and expires_at <= issued_at + interval '5 minutes'),
  constraint guard_approval_consumption_check check ((consumed_at is null and consumed_by is null) or (consumed_at is not null and consumed_by is not null))
);

create table if not exists nexus_private.execution_authorizations (
  id uuid primary key default gen_random_uuid(),
  intent_id uuid not null unique references nexus_private.order_intents(id),
  guard_approval_id uuid not null unique references nexus_private.guard_approvals(id),
  executor_id text not null,
  venue text not null,
  account_id uuid not null references nexus_private.venue_accounts(id),
  status text not null default 'submitting',
  authorized_at timestamptz not null default now(),
  expires_at timestamptz not null,
  submitted_at timestamptz,
  venue_order_id text,
  error_code text,
  updated_at timestamptz not null default now(),
  constraint execution_authorizations_status_check check (status in ('submitting','submitted','unknown','failed','reconciled','revoked')),
  constraint execution_authorizations_expiry_check check (expires_at > authorized_at and expires_at <= authorized_at + interval '5 minutes'),
  constraint execution_authorizations_submission_check check ((status <> 'submitted') or (venue_order_id is not null and submitted_at is not null))
);

create table if not exists nexus_private.guard_audit_events (
  id uuid primary key default gen_random_uuid(),
  intent_id uuid references nexus_private.order_intents(id),
  authorization_id uuid references nexus_private.execution_authorizations(id),
  event_type text not null,
  actor_id text not null,
  policy_version text,
  decision text,
  reason_code text,
  evidence_digest text,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  constraint guard_audit_event_digest_check check (evidence_digest is null or evidence_digest ~ '^[0-9a-f]{64}$')
);

create index if not exists guard_approvals_policy_time_idx on nexus_private.guard_approvals(policy_version,issued_at desc);
create index if not exists guard_approvals_expiry_idx on nexus_private.guard_approvals(expires_at) where consumed_at is null;
create index if not exists execution_authorizations_status_time_idx on nexus_private.execution_authorizations(status,authorized_at desc);
create index if not exists guard_audit_events_intent_time_idx on nexus_private.guard_audit_events(intent_id,occurred_at desc);

do $$
declare
  table_name text;
begin
  foreach table_name in array array['guard_policy_versions','guard_approvals','execution_authorizations','guard_audit_events']
  loop
    execute format('alter table nexus_private.%I enable row level security',table_name);
    execute format('revoke all on table nexus_private.%I from anon,authenticated',table_name);
    if table_name='guard_audit_events' then
      execute format('grant select,insert on table nexus_private.%I to service_role',table_name);
    else
      execute format('grant all on table nexus_private.%I to service_role',table_name);
    end if;
    if not exists(select 1 from pg_policies where schemaname='nexus_private' and tablename=table_name and policyname='service_role_only') then
      execute format('create policy service_role_only on nexus_private.%I for all to service_role using (true) with check (true)',table_name);
    end if;
  end loop;
end
$$;

create or replace function nexus_private.consume_live_authorization(
  p_intent_id uuid,
  p_executor_id text,
  p_approval_digest text
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  intent_row nexus_private.order_intents%rowtype;
  approval_row nexus_private.guard_approvals%rowtype;
  policy_state text;
  authorization_id uuid;
begin
  if p_executor_id is null or length(p_executor_id) < 1 or length(p_executor_id) > 128 then
    raise exception 'invalid_executor_id';
  end if;
  if p_approval_digest is null or p_approval_digest !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_approval_digest';
  end if;

  select * into intent_row
  from nexus_private.order_intents
  where id=p_intent_id
  for update;
  if not found then raise exception 'order_intent_not_found'; end if;
  if intent_row.requested_mode <> 'live' then raise exception 'live_mode_required'; end if;
  if intent_row.state <> 'approved' or intent_row.risk_decision_id is null then raise exception 'risk_verdict_required'; end if;
  if intent_row.request_digest is null then raise exception 'intent_digest_required'; end if;

  select * into approval_row
  from nexus_private.guard_approvals
  where intent_id=p_intent_id and approval_digest=p_approval_digest
  for update;
  if not found then raise exception 'guard_approval_not_found'; end if;
  if approval_row.decision <> 'allow' then raise exception 'guard_denied'; end if;
  if approval_row.intent_digest <> intent_row.request_digest then raise exception 'guard_intent_digest_mismatch'; end if;
  if approval_row.consumed_at is not null then raise exception 'guard_approval_replayed'; end if;
  if approval_row.expires_at <= pg_catalog.now() then raise exception 'guard_approval_expired'; end if;

  select status into policy_state
  from nexus_private.guard_policy_versions
  where policy_version=approval_row.policy_version;
  if policy_state <> 'active' then raise exception 'guard_policy_not_active'; end if;

  update nexus_private.guard_approvals
  set consumed_at=pg_catalog.now(),consumed_by=p_executor_id
  where id=approval_row.id and consumed_at is null;
  if not found then raise exception 'guard_approval_replayed'; end if;

  insert into nexus_private.execution_authorizations(intent_id,guard_approval_id,executor_id,venue,account_id,status,expires_at)
  values(p_intent_id,approval_row.id,p_executor_id,(select venue from nexus_private.venue_accounts where id=intent_row.account_id),intent_row.account_id,'submitting',pg_catalog.now()+interval '60 seconds')
  returning id into authorization_id;

  update nexus_private.order_intents
  set state='submitting',updated_at=pg_catalog.now()
  where id=p_intent_id and state='approved';

  insert into nexus_private.guard_audit_events(intent_id,authorization_id,event_type,actor_id,policy_version,decision,reason_code,evidence_digest,payload)
  values(p_intent_id,authorization_id,'live_authorization_consumed',p_executor_id,approval_row.policy_version,'allow','signed_guard_approval_consumed',approval_row.approval_digest,jsonb_build_object('signer_key_id',approval_row.signer_key_id,'signature_algorithm',approval_row.signature_algorithm,'nonce',approval_row.nonce));

  return authorization_id;
end;
$$;

create or replace function nexus_private.record_execution_submission(
  p_authorization_id uuid,
  p_executor_id text,
  p_outcome text,
  p_venue_order_id text default null,
  p_error_code text default null
)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  authorization_row nexus_private.execution_authorizations%rowtype;
  affected integer;
begin
  if p_outcome not in ('submitted','unknown','failed') then raise exception 'invalid_execution_outcome'; end if;
  select * into authorization_row
  from nexus_private.execution_authorizations
  where id=p_authorization_id
  for update;
  if not found then return false; end if;
  if authorization_row.executor_id <> p_executor_id or authorization_row.status <> 'submitting' then return false; end if;
  if authorization_row.expires_at <= pg_catalog.now() then
    update nexus_private.execution_authorizations set status='unknown',error_code='authorization_expired',updated_at=pg_catalog.now() where id=p_authorization_id;
    update nexus_private.order_intents set state='unknown',updated_at=pg_catalog.now() where id=authorization_row.intent_id;
    return false;
  end if;
  if p_outcome='submitted' and (p_venue_order_id is null or length(p_venue_order_id)=0) then raise exception 'venue_order_id_required'; end if;

  update nexus_private.execution_authorizations
  set status=p_outcome,
      venue_order_id=case when p_outcome='submitted' then p_venue_order_id else null end,
      error_code=case when p_outcome='failed' then p_error_code else null end,
      submitted_at=case when p_outcome='submitted' then pg_catalog.now() else null end,
      updated_at=pg_catalog.now()
  where id=p_authorization_id and executor_id=p_executor_id and status='submitting';
  get diagnostics affected=row_count;
  if affected <> 1 then return false; end if;

  update nexus_private.order_intents
  set state=case when p_outcome='submitted' then 'accepted' when p_outcome='failed' then 'rejected' else 'unknown' end,
      updated_at=pg_catalog.now()
  where id=authorization_row.intent_id;

  insert into nexus_private.guard_audit_events(intent_id,authorization_id,event_type,actor_id,decision,reason_code,payload)
  values(authorization_row.intent_id,p_authorization_id,'execution_submission_result',p_executor_id,p_outcome,p_error_code,jsonb_build_object('venue_order_id',p_venue_order_id));

  return true;
end;
$$;

revoke all on function nexus_private.consume_live_authorization(uuid,text,text) from public,anon,authenticated;
revoke all on function nexus_private.record_execution_submission(uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function nexus_private.consume_live_authorization(uuid,text,text) to service_role;
grant execute on function nexus_private.record_execution_submission(uuid,text,text,text,text) to service_role;
