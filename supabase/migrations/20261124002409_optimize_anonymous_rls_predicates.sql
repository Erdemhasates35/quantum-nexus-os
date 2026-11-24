do $$
declare
  target_table text;
begin
  for target_table in
    select distinct p.tablename
    from pg_policies p
    where p.schemaname='public'
      and p.policyname='permanent_users_only'
  loop
    execute format(
      'alter policy permanent_users_only on public.%I using (((select auth.jwt())->>''is_anonymous'') is distinct from ''true'') with check (((select auth.jwt())->>''is_anonymous'') is distinct from ''true'')',
      target_table
    );
  end loop;
end
$$;
