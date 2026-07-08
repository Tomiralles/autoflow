-- Reporte semanal al dueño ("reporte de ego"): el cron diario lo envía
-- los lunes con el resumen de la semana anterior. Esta columna evita
-- reenvíos si el cron se ejecuta dos veces el mismo día.
alter table public.businesses
  add column if not exists weekly_report_sent_date date;
