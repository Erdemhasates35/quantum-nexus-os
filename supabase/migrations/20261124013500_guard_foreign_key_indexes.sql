create index if not exists execution_authorizations_account_idx on nexus_private.execution_authorizations(account_id);
create index if not exists guard_audit_events_authorization_idx on nexus_private.guard_audit_events(authorization_id);
