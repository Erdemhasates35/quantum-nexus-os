create policy admin_bootstrap_owner_only
on private.admin_bootstrap_allowlist
for all
to postgres
using (true)
with check (true);
