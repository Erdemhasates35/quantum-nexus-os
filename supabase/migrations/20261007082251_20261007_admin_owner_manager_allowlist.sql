alter table public.profiles add column if not exists admin_level text;
alter table public.profiles drop constraint if exists profiles_admin_level_check;
alter table public.profiles add constraint profiles_admin_level_check check (admin_level is null or admin_level = any (array['owner','manager']));
alter table private.admin_bootstrap_allowlist add column if not exists admin_level text;
alter table private.admin_bootstrap_allowlist drop constraint if exists admin_bootstrap_allowlist_admin_level_check;
alter table private.admin_bootstrap_allowlist add constraint admin_bootstrap_allowlist_admin_level_check check (admin_level is null or admin_level = any (array['owner','manager']));
insert into private.admin_bootstrap_allowlist(email,enabled,admin_level)
values ('sema.erdem35@gmail.com',true,'owner'),('erdemhasates343@gmail.com',true,'manager')
on conflict (email) do update set enabled=excluded.enabled, admin_level=excluded.admin_level;
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
declare
  allowed boolean := false;
  admin_level_value text := null;
begin
  select a.enabled, a.admin_level
    into allowed, admin_level_value
  from private.admin_bootstrap_allowlist a
  where a.enabled=true and lower(a.email)=lower(coalesce(new.email,''))
  limit 1;

  insert into public.profiles(id,email,full_name,avatar_url,role,admin_level,is_approved,approved_at,approved_by)
  values(
    new.id,
    coalesce(new.email,''),
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    case when allowed then 'admin' else 'pending' end,
    case when allowed then admin_level_value else null end,
    allowed,
    case when allowed then now() else null end,
    case when allowed then new.id else null end
  );

  if allowed then
    insert into public.approval_logs(user_id,action,old_value,new_value,performed_by,note)
    values(new.id,'approve','pending','admin',new.id,'Administrator bootstrap via explicit database allowlist');
  end if;
  return new;
end;
$function$;
