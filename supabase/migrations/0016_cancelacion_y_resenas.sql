-- (1) Cancelación por el cliente: cada cita lleva un token secreto; el
-- email/WhatsApp incluye un enlace /cancelar/{token} donde el cliente
-- ve su cita y la cancela él mismo (libera el hueco sin llamadas).
-- La página muestra la cita (get_appointment_by_token) y el botón hace
-- la cancelación (cancel_appointment) — nunca se cancela por GET, los
-- escáneres de enlaces de los correos harían estragos.
--
-- (2) Reseñas de Google: enlace por negocio; al terminar la faena se
-- invita al cliente a dejar reseña.

alter table public.appointments
  add column cancel_token uuid not null default gen_random_uuid();

create unique index appointments_cancel_token on public.appointments (cancel_token);

alter table public.businesses
  add column google_review_url text;

-- Datos mínimos para la página de cancelación (sin exponer nada más)
create function public.get_appointment_by_token(p_token uuid)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'client_name', a.client_name,
    'service_name', a.service_name,
    'date', a.date,
    'time', a.time,
    'status', a.status,
    'business_name', b.name,
    'business_phone', b.phone,
    'cancelable', a.status in ('pendiente', 'confirmada')
      and (a.date + a.time) > (now() at time zone 'Europe/Madrid')
  )
  from appointments a
  join businesses b on b.id = a.business_id
  where a.cancel_token = p_token;
$$;

revoke execute on function public.get_appointment_by_token(uuid) from public;
grant execute on function public.get_appointment_by_token(uuid) to anon, authenticated;

-- Cancela y devuelve los datos para avisar al dueño
create function public.cancel_appointment(p_token uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_apt record;
begin
  select a.id, a.client_name, a.service_name, a.date, a.time, a.status,
         b.name as business_name, b.email as business_email, b.phone as business_phone
  into v_apt
  from appointments a
  join businesses b on b.id = a.business_id
  where a.cancel_token = p_token;

  if not found then
    return jsonb_build_object('error', 'no_encontrada');
  end if;
  if v_apt.status not in ('pendiente', 'confirmada') then
    return jsonb_build_object('error', 'no_cancelable');
  end if;
  if (v_apt.date + v_apt.time) <= (now() at time zone 'Europe/Madrid') then
    return jsonb_build_object('error', 'ya_pasada');
  end if;

  update appointments set status = 'cancelada' where id = v_apt.id;

  return jsonb_build_object(
    'ok', true,
    'client_name', v_apt.client_name,
    'service_name', v_apt.service_name,
    'date', v_apt.date,
    'time', v_apt.time,
    'business_name', v_apt.business_name,
    'business_email', v_apt.business_email,
    'business_phone', v_apt.business_phone
  );
end;
$$;

revoke execute on function public.cancel_appointment(uuid) from public;
grant execute on function public.cancel_appointment(uuid) to anon, authenticated;

-- book_appointment devuelve también cancel_token (para el enlace de
-- cancelación en el email de reserva). Cambios: declare v_cancel_token,
-- RETURNING id, cancel_token y la clave 'cancel_token' en el jsonb.
-- (Aplicado como migración aparte "book_appointment_devuelve_cancel_token"
-- con el cuerpo completo de la función; aquí solo queda documentado el
-- diff para no duplicar 200 líneas.)
