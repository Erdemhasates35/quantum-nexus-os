CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.bootstrap_admin_internal(bootstrap_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  caller uuid := auth.uid();
  existing_admin integer;
BEGIN
  IF caller IS NULL THEN RETURN false; END IF;
  IF lower(coalesce((SELECT email FROM auth.users WHERE id=caller),'')) <> lower(trim(bootstrap_email)) THEN RETURN false; END IF;
  SELECT count(*) INTO existing_admin FROM public.profiles WHERE role='admin';
  IF existing_admin > 0 THEN RETURN false; END IF;
  UPDATE public.profiles
    SET role='admin', is_approved=true, approved_at=now(), approved_by=caller
    WHERE id=caller;
  IF NOT FOUND THEN RETURN false; END IF;
  INSERT INTO public.approval_logs(user_id,action,old_value,new_value,performed_by,note)
    VALUES(caller,'approve','pending','admin',caller,'Initial administrator bootstrap');
  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION private.bootstrap_admin_internal(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.bootstrap_admin_internal(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.bootstrap_admin(bootstrap_email text)
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, private
AS $function$
  SELECT private.bootstrap_admin_internal(bootstrap_email);
$function$;

REVOKE ALL ON FUNCTION public.bootstrap_admin(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_admin(text) TO authenticated;
