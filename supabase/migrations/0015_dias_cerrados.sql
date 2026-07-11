-- Vacaciones y días cerrados del negocio. Sin esto entraban reservas
-- estando el negocio de vacaciones (solo existía el horario semanal).
-- Rangos [start_date, end_date] ambos inclusive; un solo día = mismo
-- valor en ambos. El widget deshabilita los días y book_appointment
-- es la última línea de defensa (error 'cerrado').

create table public.business_closures (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  start_date date not null,
  end_date date not null,
  reason text,
  created_at timestamptz not null default now(),
  constraint closures_rango_valido check (end_date >= start_date)
);

create index on public.business_closures (business_id, end_date);

alter table public.business_closures enable row level security;
create policy "member all" on public.business_closures for all
  using (public.is_business_member(business_id))
  with check (public.is_business_member(business_id));

-- Datos públicos: el widget necesita los cierres vigentes para
-- deshabilitar días en el calendario (nada sensible).
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
    ), '[]'::jsonb),
    'staff', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', st.id,
        'name', st.name,
        'working_hours', st.working_hours
      ) order by st.sort_order, st.created_at)
      from staff st
      where st.business_id = b.id and st.is_active
    ), '[]'::jsonb),
    'closures', coalesce((
      select jsonb_agg(jsonb_build_object(
        'start', c.start_date,
        'end', c.end_date
      ) order by c.start_date)
      from business_closures c
      where c.business_id = b.id and c.end_date >= current_date
    ), '[]'::jsonb)
  )
  from businesses b
  where b.slug = p_slug
    and b.onboarding_completed
    and b.plan_status <> 'inactive';
$$;

-- book_appointment: rechazar fechas dentro de un cierre (misma firma,
-- solo se añade el gate tras encontrar el negocio)
create or replace function public.book_appointment(
  p_slug text,
  p_service_id uuid,
  p_date date,
  p_time time,
  p_name text,
  p_email text,
  p_phone text,
  p_staff_id uuid default null
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
  v_dur int;
  v_staff record;
  v_staff_id uuid;
  v_staff_name text;
begin
  if p_name is null or length(trim(p_name)) = 0 then
    return jsonb_build_object('error', 'datos_invalidos');
  end if;
  if length(p_name) > 120 or length(coalesce(p_email, '')) > 200 or length(coalesce(p_phone, '')) > 40 then
    return jsonb_build_object('error', 'datos_invalidos');
  end if;
  if (p_date + p_time) < (now() at time zone 'Europe/Madrid') then
    return jsonb_build_object('error', 'fecha_pasada');
  end if;

  select id, name, phone, address, working_hours into v_biz
  from businesses
  where slug = p_slug and onboarding_completed and plan_status <> 'inactive';
  if not found then
    return jsonb_build_object('error', 'negocio_no_encontrado');
  end if;

  -- Vacaciones / día cerrado
  if exists (
    select 1 from business_closures c
    where c.business_id = v_biz.id
      and p_date between c.start_date and c.end_date
  ) then
    return jsonb_build_object('error', 'cerrado');
  end if;

  select id, name, duration_minutes, materials_notes into v_svc
  from services
  where id = p_service_id and business_id = v_biz.id and is_active;
  if not found then
    return jsonb_build_object('error', 'servicio_no_encontrado');
  end if;
  v_dur := coalesce(v_svc.duration_minutes, 60);

  if exists (select 1 from staff s where s.business_id = v_biz.id and s.is_active) then
    if p_staff_id is not null then
      select id, name, working_hours into v_staff
      from staff
      where id = p_staff_id and business_id = v_biz.id and is_active;
      if not found then
        return jsonb_build_object('error', 'trabajador_no_encontrado');
      end if;
      if not horario_permite(coalesce(v_staff.working_hours, v_biz.working_hours), p_date, p_time, v_dur) then
        return jsonb_build_object('error', 'fuera_de_horario');
      end if;
      v_staff_id := v_staff.id;
      v_staff_name := v_staff.name;
    else
      select s.id, s.name into v_staff_id, v_staff_name
      from staff s
      where s.business_id = v_biz.id
        and s.is_active
        and horario_permite(coalesce(s.working_hours, v_biz.working_hours), p_date, p_time, v_dur)
        and not exists (
          select 1 from appointments a
          where a.business_id = v_biz.id
            and a.staff_id = s.id
            and a.status not in ('cancelada', 'no_asistio')
            and tsrange(
              (a.date + a.time)::timestamp,
              (a.date + a.time)::timestamp + make_interval(mins => coalesce(a.duration_minutes, 60)),
              '[)'
            ) && tsrange(
              (p_date + p_time)::timestamp,
              (p_date + p_time)::timestamp + make_interval(mins => v_dur),
              '[)'
            )
        )
      order by s.sort_order, s.created_at
      limit 1;
      if v_staff_id is null then
        return jsonb_build_object('error', 'hueco_ocupado');
      end if;
    end if;
  else
    if not horario_permite(v_biz.working_hours, p_date, p_time, v_dur) then
      return jsonb_build_object('error', 'fuera_de_horario');
    end if;
  end if;

  insert into leads (
    business_id, full_name, email, phone, service_id, service_name,
    score, score_label, pipeline_stage, next_action, next_action_date,
    appointment_date, appointment_time, source, status, last_contact_date,
    consent_at
  ) values (
    v_biz.id, trim(p_name), nullif(trim(p_email), ''), nullif(trim(p_phone), ''),
    v_svc.id, v_svc.name,
    80, 'caliente', 'nuevo_lead', 'confirmar_cita', p_date,
    p_date, p_time, 'pagina_publica', 'activo', now(),
    now()
  ) returning id into v_lead_id;

  begin
    insert into appointments (
      business_id, lead_id, service_id, service_name,
      client_name, client_email, client_phone,
      date, time, duration_minutes, materials_notes, status, staff_id
    ) values (
      v_biz.id, v_lead_id, v_svc.id, v_svc.name,
      trim(p_name), nullif(trim(p_email), ''), nullif(trim(p_phone), ''),
      p_date, p_time, v_dur, v_svc.materials_notes, 'pendiente', v_staff_id
    ) returning id into v_apt_id;
  exception when unique_violation or exclusion_violation then
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
    'duration_minutes', v_dur,
    'staff_name', v_staff_name,
    'email_subject', v_auto.email_subject,
    'email_body', v_auto.email_body
  );
end;
$$;
