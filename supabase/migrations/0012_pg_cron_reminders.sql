-- ============================================================
-- Recordatorios horarios vía pg_cron + pg_net (dentro de Supabase)
-- en vez del cron de Vercel. El plan Hobby de Vercel solo permite
-- crons DIARIOS, así que el recordatorio de 24h llevaba desde la
-- Fase 6 corriendo una sola vez al día (07:30 UTC) en vez de cada
-- hora como en la versión Base44 original. pg_net puede llamar por
-- HTTP al mismo endpoint de Vercel con la frecuencia que queramos,
-- sin tocar la lógica de la app (mismo GET, mismo CRON_SECRET).
--
-- net.http_get es ASÍNCRONO: la llamada se encola y un worker de
-- background la ejecuta; el resultado (status, body) se puede
-- consultar después en net._http_response por request_id. No hace
-- falta esperar la respuesta aquí, es "fire and forget".
--
-- El CRON_SECRET NO va en texto plano en esta migración (se
-- commitea a git) — vive cifrado en Supabase Vault bajo el nombre
-- 'cron_secret_reminders' (creado aparte, fuera de las migraciones,
-- con `select vault.create_secret(valor, 'cron_secret_reminders',
-- descripcion)`) y aquí solo se referencia por nombre.
--
-- Las automatizaciones (checkInactiveLeads y demás, 1 vez al día)
-- se quedan en vercel.json: no ganan nada con más frecuencia.
-- ============================================================

create extension if not exists pg_net;

select cron.schedule(
  'recordatorios-citas-24h',
  '0 * * * *', -- cada hora en punto
  $$
  select net.http_get(
    url := 'https://autoflow-tonis-projects-baabf0b8.vercel.app/api/cron/reminders',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'cron_secret_reminders'
      )
    ),
    timeout_milliseconds := 25000
  );
  $$
);
