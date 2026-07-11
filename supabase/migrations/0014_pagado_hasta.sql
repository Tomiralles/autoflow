-- Cobro manual: hasta cuándo tiene pagado cada negocio. El admin renueva
-- con "+1 mes" en /admin tras cobrar (Bizum/transferencia). Al vencer NO
-- se apaga nada solo: se avisa al admin (email + semáforo) y él decide.

alter table public.businesses add column if not exists paid_until date;

-- El listado del panel admin incluye la fecha de pago
create or replace function public.admin_list_businesses()
returns jsonb
language sql stable security definer set search_path = public
as $$
  select case when public.is_admin() then
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id,
        'name', b.name,
        'slug', b.slug,
        'sector', b.sector,
        'plan', b.plan,
        'plan_status', b.plan_status,
        'created_at', b.created_at,
        'paid_until', b.paid_until,
        'owner_email', u.email,
        'citas', (select count(*) from appointments a where a.business_id = b.id),
        'clientes', (select count(*) from leads l where l.business_id = b.id)
      ) order by b.created_at desc)
      from businesses b
      left join auth.users u on u.id = b.owner_id
    ), '[]'::jsonb)
  end;
$$;

revoke execute on function public.admin_list_businesses() from public, anon;
grant execute on function public.admin_list_businesses() to authenticated;
