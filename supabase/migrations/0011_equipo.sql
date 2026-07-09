-- ============================================================
-- EQUIPO (multi-trabajador).
-- Hasta ahora el anti-solape era por negocio: una sola cita
-- simultánea. Para una peluquería de 3 sillas eso es un límite
-- real. Ahora cada negocio puede tener trabajadores (tabla staff,
-- sin login — no confundir con employees, que son usuarios de la
-- app con permisos) y el solape se controla POR TRABAJADOR.
-- Negocios de 1 persona: sin filas en staff, todo sigue igual
-- (staff_id null y el coalesce del constraint mantiene el bloqueo
-- por negocio).
-- ============================================================

create table public.staff (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null,
  working_hours jsonb, -- null = usa el horario del negocio
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on public.staff (business_id);

alter table public.staff enable row level security;
create policy "member all" on public.staff for all
  using (public.is_business_member(business_id))
  with check (public.is_business_member(business_id));

create trigger set_updated_at before update on public.staff
  for each row execute function public.set_updated_at();

alter table public.appointments
  add column staff_id uuid references public.staff (id) on delete set null;

create index on public.appointments (staff_id);

-- El índice único (business_id, date, time) impediría dos citas a la
-- misma hora con distinto trabajador. El constraint de exclusión por
-- trabajador cubre todo lo que cubría él.
drop index public.appointments_no_double_booking;

alter table public.appointments drop constraint appointments_no_overlap;
alter table public.appointments
  add constraint appointments_no_overlap
  exclude using gist (
    business_id with =,
    coalesce(staff_id, '00000000-0000-0000-0000-000000000000'::uuid) with =,
    tsrange(
      (date + time)::timestamp,
      (date + time)::timestamp + make_interval(mins => coalesce(duration_minutes, 60)),
      '[)'
    ) with &&
  ) where (status not in ('cancelada', 'no_asistio'));

-- ¿Permite un horario (formato working_hours) una cita de p_mins
-- minutos ese día a esa hora? Mismos claves y por-defecto que
-- lib/slots.ts: días en español, sin configurar = L-S 09:00-19:00.
-- Aritmética en minutos para no lidiar con el wrap de time+interval.
create or replace function public.horario_permite(
  p_hours jsonb,
  p_date date,
  p_time time,
  p_mins integer
)
returns boolean
language plpgsql immutable
as $$
declare
  v_dia text := (array['domingo','lunes','martes','miercoles','jueves','viernes','sabado'])[extract(dow from p_date)::int + 1];
  v_d jsonb;
  v_ini int := extract(hour from p_time)::int * 60 + extract(minute from p_time)::int;
  v_start int;
  v_end int;
begin
  if p_hours is null or p_hours = '{}'::jsonb then
    if v_dia = 'domingo' then return false; end if;
    v_start := 9 * 60;
    v_end := 19 * 60;
  else
    v_d := p_hours -> v_dia;
    if v_d is null or not coalesce((v_d ->> 'open')::boolean, false) then
      return false;
    end if;
    v_start := split_part(coalesce(v_d ->> 'start', '09:00'), ':', 1)::int * 60
             + split_part(coalesce(v_d ->> 'start', '09:00'), ':', 2)::int;
    v_end := split_part(coalesce(v_d ->> 'end', '19:00'), ':', 1)::int * 60
           + split_part(coalesce(v_d ->> 'end', '19:00'), ':', 2)::int;
  end if;
  return v_ini >= v_start and v_ini + p_mins <= v_end;
end;
$$;

revoke execute on function public.horario_permite(jsonb, date, time, integer) from public;

-- Equipo activo en los datos públicos (el widget necesita nombre y
-- horario de cada trabajador para calcular huecos; nada sensible).
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
    ), '[]'::jsonb)
  )
  from businesses b
  where b.slug = p_slug
    and b.onboarding_completed
    and b.plan_status <> 'inactive';
$$;

-- Ocupación con trabajador (cambio de tipo → drop + create + re-grants)
drop function public.get_booked_slots(text, date);

create function public.get_booked_slots(p_slug text, p_date date)
returns table (start_time time, duration_minutes integer, staff_id uuid)
language sql stable security definer set search_path = public
as $$
  select a.time, coalesce(a.duration_minutes, 60), a.staff_id
  from appointments a
  join businesses b on b.id = a.business_id
  where b.slug = p_slug
    and a.date = p_date
    and a.status not in ('cancelada', 'no_asistio');
$$;

revoke execute on function public.get_booked_slots(text, date) from public;
grant execute on function public.get_booked_slots(text, date) to anon, authenticated;

-- book_appointment con trabajador. p_staff_id null con equipo activo
-- = "me da igual": se asigna el primer trabajador que trabaje a esa
-- hora y esté libre. La firma cambia → drop de la vieja.
drop function public.book_appointment(text, uuid, date, time, text, text, text);

create function public.book_appointment(
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
      -- Primer trabajador libre que trabaje a esa hora. Si otro cliente
      -- se lo lleva entre este select y el insert, el constraint de
      -- exclusión lo convierte en 'hueco_ocupado' (reintenta y le toca
      -- otro trabajador libre si lo hay).
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
    -- Sin equipo: última línea contra reservas fuera del horario del
    -- negocio (el widget ya no las ofrece, como con las horas pasadas)
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
    -- Otro cliente ganó el hueco (o uno solapado) entre el render y el submit
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

revoke execute on function public.book_appointment(text, uuid, date, time, text, text, text, uuid) from public;
grant execute on function public.book_appointment(text, uuid, date, time, text, text, text, uuid) to anon, authenticated;
