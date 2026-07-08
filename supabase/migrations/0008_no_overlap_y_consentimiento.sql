-- ============================================================
-- 1) Anti-solapamiento real de citas.
--    El índice único (business_id, date, time) solo bloqueaba dos citas
--    a la misma hora exacta: una cita de 120 min NO bloqueaba un hueco
--    de 25 min a los 15 minutos de empezar. Constraint de exclusión por
--    rango: dos citas activas del mismo negocio no pueden solaparse.
-- 2) Consentimiento RGPD: leads.consent_at guarda cuándo aceptó el
--    cliente la política de privacidad al reservar.
-- ============================================================

create extension if not exists btree_gist;

alter table public.appointments
  add constraint appointments_no_overlap
  exclude using gist (
    business_id with =,
    tsrange(
      (date + time)::timestamp,
      (date + time)::timestamp + make_interval(mins => coalesce(duration_minutes, 60)),
      '[)'
    ) with &&
  ) where (status not in ('cancelada', 'no_asistio'));

alter table public.leads
  add column if not exists consent_at timestamptz;

-- Huecos ocupados con su duración (antes solo la hora de inicio, lo que
-- impedía filtrar por solapamiento en el widget). Cambia el tipo de
-- retorno → hay que recrear la función.
drop function public.get_booked_slots(text, date);

create function public.get_booked_slots(p_slug text, p_date date)
returns table (start_time time, duration_minutes integer)
language sql stable security definer set search_path = public
as $$
  select a.time, coalesce(a.duration_minutes, 60)
  from appointments a
  join businesses b on b.id = a.business_id
  where b.slug = p_slug
    and a.date = p_date
    and a.status not in ('cancelada', 'no_asistio');
$$;

revoke execute on function public.get_booked_slots(text, date) from public;
grant execute on function public.get_booked_slots(text, date) to anon, authenticated;

-- book_appointment: captura también exclusion_violation (el constraint
-- nuevo dispara 23P01, no unique_violation) y registra el consentimiento.
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
      date, time, duration_minutes, materials_notes, status
    ) values (
      v_biz.id, v_lead_id, v_svc.id, v_svc.name,
      trim(p_name), nullif(trim(p_email), ''), nullif(trim(p_phone), ''),
      p_date, p_time, coalesce(v_svc.duration_minutes, 60), v_svc.materials_notes, 'pendiente'
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
    'duration_minutes', coalesce(v_svc.duration_minutes, 60),
    'email_subject', v_auto.email_subject,
    'email_body', v_auto.email_body
  );
end;
$$;
