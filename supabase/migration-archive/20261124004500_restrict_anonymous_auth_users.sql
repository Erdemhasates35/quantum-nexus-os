do $$
declare
  target_table text;
begin
  for target_table in
    select distinct p.tablename
    from pg_policies p
    where p.schemaname='public'
      and p.roles @> array['authenticated']::name[]
  loop
    if not exists (
      select 1 from pg_policies p
      where p.schemaname='public'
        and p.tablename=target_table
        and p.policyname='permanent_users_only'
    ) then
      execute format(
        'create policy permanent_users_only on public.%I as restrictive for all to authenticated using ((select auth.jwt()->>''is_anonymous'') is distinct from ''true'') with check ((select auth.jwt()->>''is_anonymous'') is distinct from ''true'')',
        target_table
      );
    end if;
  end loop;
end
$$;
