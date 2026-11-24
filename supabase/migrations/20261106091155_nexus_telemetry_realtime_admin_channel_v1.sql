create policy nexus_telemetry_admin_receive
on realtime.messages
for select
to authenticated
using (
  realtime.topic() = 'nexus:telemetry:admin'
  and exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
      and p.is_approved is true
      and p.admin_level in ('owner','manager')
  )
);
