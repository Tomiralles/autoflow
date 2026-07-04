-- Endurecimiento tras el linter de seguridad de Supabase (advisors):
-- 1) search_path fijo en set_updated_at (era mutable)
-- 2) Las funciones SECURITY DEFINER dejan de ser RPC públicos.
--    OJO: authenticated CONSERVA execute sobre los helpers de RLS
--    (las policies se evalúan con los privilegios del usuario que
--    consulta), y handle_new_user lo ejecuta supabase_auth_admin
--    (el trigger de auth.users). Revocar de más rompería RLS o el signup.

alter function public.set_updated_at() set search_path = public;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to supabase_auth_admin;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

revoke execute on function public.is_business_member(uuid) from public, anon;
grant execute on function public.is_business_member(uuid) to authenticated;
