-- Listado de negocios para el panel admin (cobro manual). El email del
-- dueño vive en auth.users (sin grant para authenticated), así que va por
-- definer con el check de admin DENTRO de la función: para no-admins
-- devuelve NULL, exponga lo que exponga el grant. Los updates de
-- plan/plan_status no necesitan RPC: la policy "owner update" ya permite
-- is_admin().
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
