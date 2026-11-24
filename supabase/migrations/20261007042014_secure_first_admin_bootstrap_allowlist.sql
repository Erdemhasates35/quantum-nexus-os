
create table if not exists private.admin_bootstrap_allowlist(email text primary key, enabled boolean not null default true, created_at timestamptz not null default now());
revoke all on private.admin_bootstrap_allowlist from public, anon, authenticated;
insert into private.admin_bootstrap_allowlist(email,enabled) values ('sema.erdem35@gmail.com',true) on conflict(email) do update set enabled=excluded.enabled;
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=''
as $function$
declare make_admin boolean := false;
begin
  select exists(select 1 from private.admin_bootstrap_allowlist a where a.enabled=true and lower(a.email)=lower(coalesce(new.email,'')))
    and not exists(select 1 from public.profiles p where p.role='admin' and p.is_approved=true) into make_admin;
  insert into public.profiles(id,email,full_name,avatar_url,role,is_approved,approved_at,approved_by)
  values(new.id,coalesce(new.email,''),new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'avatar_url',
    case when make_admin then 'admin' else 'pending' end,make_admin,case when make_admin then now() else null end,case when make_admin then new.id else null end);
  if make_admin then
    insert into public.approval_logs(user_id,action,old_value,new_value,performed_by,note)
    values(new.id,'approve','pending','admin',new.id,'Initial administrator bootstrap via database allowlist');
  end if;
  return new;
end;
$function$;
revoke all on function public.bootstrap_admin(text) from public, anon, authenticated;
revoke all on function private.bootstrap_admin(text) from public, anon, authenticated;
revoke all on function private.bootstrap_admin_internal(text) from public, anon, authenticated;
