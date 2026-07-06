-- Test de aislamiento RLS entre negocios. Ejecutar como postgres en el
-- SQL Editor de Supabase (o vía MCP). Esperado:
--   leads/citas/facturas ajenas visibles = 0, ve_negocio_ajeno = 0,
--   ve_su_negocio = 1, escritura_ajena_denegada = true
-- La limpieza va al final — ejecutarla siempre.

insert into auth.users (id, email, aud, role)
values ('00000000-0000-4000-8000-00000000b0b0', 'rls-test-b@test.local', 'authenticated', 'authenticated')
on conflict (id) do nothing;
insert into public.businesses (owner_id, name, slug, onboarding_completed)
values ('00000000-0000-4000-8000-00000000b0b0', 'Negocio B (test RLS)', 'negocio-b-rls-test', true);
create temp table objetivo as
  select id from public.businesses where slug = 'peluqueria-la-prueba';

-- Simular al usuario B (JWT transaction-local)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000b0b0","role":"authenticated"}', true);
select set_config('role', 'authenticated', true);

do $$
declare
  denegado boolean := false;
begin
  begin
    insert into public.services (business_id, name)
    select id, 'intrusion' from objetivo;
  exception when others then
    denegado := true;
  end;
  create temp table resultado_escritura as select denegado;
end $$;

select
  (select count(*) from public.leads) as leads_ajenos_visibles,
  (select count(*) from public.appointments) as citas_ajenas_visibles,
  (select count(*) from public.invoices) as facturas_ajenas_visibles,
  (select count(*) from public.businesses where slug = 'peluqueria-la-prueba') as ve_negocio_ajeno,
  (select count(*) from public.businesses where slug = 'negocio-b-rls-test') as ve_su_negocio,
  (select denegado from resultado_escritura) as escritura_ajena_denegada;

-- Limpieza (vuelve a postgres al cerrar la transacción del batch anterior)
delete from public.businesses where slug = 'negocio-b-rls-test';
delete from auth.users where email = 'rls-test-b@test.local';
