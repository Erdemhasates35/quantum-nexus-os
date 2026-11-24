do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and cmd = 'SELECT'
  ) then
    create policy "Users read own profile or admins read all"
      on public.profiles
      for select
      to authenticated
      using ( (select auth.uid()) = id or (select private.is_admin()) );
  end if;
end $$;
