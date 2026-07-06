-- ============================================================
-- Página pública de reservas: acceso anónimo SOLO vía estas tres
-- funciones SECURITY DEFINER. Sin policies de anon sobre las tablas
-- (RLS intacto) y sin service role en el servidor web: cada función
-- expone exactamente las columnas/acciones que necesita el flujo.
-- Gate de cobro manual: plan_status = 'inactive' apaga la página.
-- ============================================================

-- Datos públicos del negocio + servicios activos (columnas seguras;
-- nunca tokens de WhatsApp ni plan interno)
create or replace function public.get_public_business(p_slug text)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'id', b.id,
    'name', b.name,
    'slug', b.slug,
    'description', b.description,
    'sector', b.sector,
    'phone', b.phone,
    'email', b.email,
    'address', b.address,
    'logo_url', b.logo_url,
    'hero_image_url', b.hero_image_url,
    'primary_color', b.primary_color,
    'secondary_color', b.secondary_color,
    'social_links', b.social_links,
    'working_hours', b.working_hours,
    'public_page_settings', b.public_page_settings,
    'services', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'name', s.name,
        'description', s.description,
        'price', s.price,
        'duration_minutes', s.duration_minutes,
        'image_url', s.image_url,
        'category', s.category
      ) order by s.sort_order)
      from services s
      where s.business_id = b.id and s.is_active
    ), '[]'::jsonb)
  )
  from businesses b
  where b.slug = p_slug
    and b.onboarding_completed
    and b.plan_status <> 'inactive';
$$;

-- Horas ocupadas de un día (solo la hora, nada del cliente)
create or replace function public.get_booked_slots(p_slug text, p_date date)
returns setof time
language sql stable security definer set search_path = public
as $$
  select a.time
  from appointments a
  join businesses b on b.id = a.business_id
  where b.slug = p_slug
    and a.date = p_date
    and a.status not in ('cancelada', 'no_asistio');
$$;

-- Reserva completa: valida, crea lead + cita pendiente + tarea de
-- confirmación para el dueño, y devuelve lo que el servidor necesita
-- para el email (texto de la automatización incluido; es contenido
-- que el propio negocio muestra a sus clientes, no un secreto).
create or replace function public.book_appointment(
  p_slug text,
  p_service_id uuid,
  p_date date,
  p_time time,
  p_name text,
  p_email text,
  p_phone text
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_biz record;
  v_svc record;
  v_lead_id uuid;
  v_apt_id uuid;
  v_auto record;
begin
  if p_name is null or length(trim(p_name)) = 0 then
    return jsonb_build_object('error', 'datos_invalidos');
  end if;
  if length(p_name) > 120 or length(coalesce(p_email, '')) > 200 or length(coalesce(p_phone, '')) > 40 then
    return jsonb_build_object('error', 'datos_invalidos');
  end if;
  if p_date < (now() at time zone 'Europe/Madrid')::date then
    return jsonb_build_object('error', 'fecha_pasada');
  end if;

  select id, name, phone, address into v_biz
  from businesses
  where slug = p_slug and onboarding_completed and plan_status <> 'inactive';
  if not found then
    return jsonb_build_object('error', 'negocio_no_encontrado');
  end if;

  select id, name, duration_minutes, materials_notes into v_svc
  from services
  where id = p_service_id and business_id = v_biz.id and is_active;
  if not found then
    return jsonb_build_object('error', 'servicio_no_encontrado');
  end if;

  insert into leads (
    business_id, full_name, email, phone, service_id, service_name,
    score, score_label, pipeline_stage, next_action, next_action_date,
    appointment_date, appointment_time, source, status, last_contact_date
  ) values (
    v_biz.id, trim(p_name), nullif(trim(p_email), ''), nullif(trim(p_phone), ''),
    v_svc.id, v_svc.name,
    80, 'caliente', 'nuevo_lead', 'confirmar_cita', p_date,
    p_date, p_time, 'pagina_publica', 'activo', now()
  ) returning id into v_lead_id;

  begin
    insert into appointments (
      business_id, lead_id, service_id, service_name,
      client_name, client_email, client_phone,
      date, time, duration_minutes, materials_notes, status
    ) values (
      v_biz.id, v_lead_id, v_svc.id, v_svc.name,
      trim(p_name), nullif(trim(p_email), ''), nullif(trim(p_phone), ''),
      p_date, p_time, coalesce(v_svc.duration_minutes, 60), v_svc.materials_notes, 'pendiente'
    ) returning id into v_apt_id;
  exception when unique_violation then
    -- Otro cliente ganó el hueco entre el render y el submit
    delete from leads where id = v_lead_id;
    return jsonb_build_object('error', 'hueco_ocupado');
  end;

  insert into tasks (
    business_id, lead_id, lead_name, lead_phone, title, type,
    due_date, priority, status, created_by_automation
  ) values (
    v_biz.id, v_lead_id, trim(p_name), nullif(trim(p_phone), ''),
    'Confirmar cita - ' || trim(p_name), 'confirmar_cita',
    p_date, 'alta', 'pendiente', true
  );

  -- Texto personalizado de la automatización de confirmación, si está activa
  select id, email_subject, email_body into v_auto
  from automations
  where business_id = v_biz.id
    and trigger = 'cita_reservada'
    and condition_days = 0
    and is_active
  limit 1;

  if v_auto.id is not null and nullif(trim(p_email), '') is not null then
    update automations
    set last_run = now(), runs_count = runs_count + 1
    where id = v_auto.id;
  end if;

  return jsonb_build_object(
    'appointment_id', v_apt_id,
    'business_name', v_biz.name,
    'business_phone', v_biz.phone,
    'business_address', v_biz.address,
    'service_name', v_svc.name,
    'duration_minutes', coalesce(v_svc.duration_minutes, 60),
    'email_subject', v_auto.email_subject,
    'email_body', v_auto.email_body
  );
end;
$$;

-- Solo ejecutables vía API (anon/authenticated); nada de PUBLIC
revoke execute on function public.get_public_business(text) from public;
revoke execute on function public.get_booked_slots(text, date) from public;
revoke execute on function public.book_appointment(text, uuid, date, time, text, text, text) from public;
grant execute on function public.get_public_business(text) to anon, authenticated;
grant execute on function public.get_booked_slots(text, date) to anon, authenticated;
grant execute on function public.book_appointment(text, uuid, date, time, text, text, text) to anon, authenticated;
