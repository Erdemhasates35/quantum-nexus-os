create or replace function private.can_access_proceeding(p_proceeding_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.proceedings p
    where p.id = p_proceeding_id
      and (p.created_by = auth.uid() or private.is_admin(auth.uid()))
  );
$function$;

create or replace function private.is_admin(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.profiles
    where id = uid and role = 'admin' and is_approved = true
  );
$function$;

create or replace function private.is_approved_user(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.profiles
    where id = uid and is_approved = true
  );
$function$;

create or replace function private.bootstrap_admin(bootstrap_email text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  caller uuid := auth.uid();
  existing_admin integer;
begin
  if caller is null then return false; end if;
  if lower(coalesce((select email from auth.users where id = caller),'')) <> lower(trim(bootstrap_email)) then return false; end if;
  select count(*) into existing_admin from public.profiles where role = 'admin';
  if existing_admin > 0 then return false; end if;
  update public.profiles
    set role='admin', is_approved=true, approved_at=pg_catalog.now(), approved_by=caller
    where id=caller;
  if not found then return false; end if;
  insert into public.approval_logs(user_id,action,old_value,new_value,performed_by,note)
    values(caller,'approve','pending','admin',caller,'Initial administrator bootstrap');
  return true;
end;
$function$;
