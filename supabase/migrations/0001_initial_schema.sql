-- ============================================================
-- AutoFlow AI — esquema inicial
-- Migrado desde las 12 entidades Base44 del proyecto original:
--   User -> profiles (ligado a auth.users)
--   SyncState -> descartada (era el sync token del webhook de
--     Google Calendar eliminado en el proyecto viejo)
--   Las 10 restantes -> tablas homónimas en snake_case plural
-- Multi-tenancy: toda tabla de negocio lleva business_id y RLS.
-- La página pública de reservas NO usa acceso anónimo directo:
-- se sirve desde rutas de servidor con la service role key.
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- profiles: perfil de aplicación 1:1 con auth.users
-- role 'admin' = dueño del SaaS (Tomi); 'user' = dueño de negocio
-- ------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  role text not null default 'user' check (role in ('admin', 'user')),
  created_at timestamptz not null default now()
);

-- Crear el perfil automáticamente al registrarse un usuario
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- businesses
-- ------------------------------------------------------------
create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id),
  name text not null,
  slug text not null unique,
  logo_url text,
  primary_color text not null default '#3B82F6',
  secondary_color text not null default '#0F172A',
  description text,
  sector text check (sector in ('estetica', 'taller', 'peluqueria', 'retail', 'servicios', 'otro')),
  phone text,
  email text,
  address text,
  hero_image_url text,
  plan text not null default 'free' check (plan in ('free', 'pro', 'enterprise')),
  plan_status text not null default 'trial' check (plan_status in ('active', 'inactive', 'trial')),
  onboarding_completed boolean not null default false,
  working_hours jsonb,
  social_links jsonb,
  -- Toggles de personalización de la página pública (decisión de
  -- producto: toggles simples, nunca constructor visual)
  public_page_settings jsonb not null default '{
    "show_prices": true,
    "show_phone": true,
    "show_address": true,
    "show_hero": true,
    "show_social": true,
    "policies_text": ""
  }'::jsonb,
  whatsapp_instance_id text,
  whatsapp_api_token text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- employees (miembros de un negocio con permisos granulares)
-- ------------------------------------------------------------
create table public.employees (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  full_name text not null,
  email text not null,
  role text not null default 'empleado' check (role in ('dueno', 'empleado')),
  permissions jsonb not null default '{
    "can_view_finance": false,
    "can_manage_automations": false,
    "can_manage_services": false,
    "can_view_all_leads": true,
    "can_delete_leads": false
  }'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- services
-- ------------------------------------------------------------
create table public.services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null,
  description text,
  price numeric(10, 2),
  duration_minutes integer,
  image_url text,
  category text,
  materials_notes text,
  is_active boolean not null default true,
  quiz_questions jsonb not null default '[]'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- leads
-- ------------------------------------------------------------
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  full_name text not null,
  email text,
  phone text,
  service_id uuid references public.services (id) on delete set null,
  service_name text,
  quiz_answers jsonb,
  score numeric not null default 0,
  score_label text not null default 'tibio' check (score_label in ('frio', 'tibio', 'caliente')),
  pipeline_stage text not null default 'nuevo_lead',
  appointment_date date,
  appointment_time time,
  estimated_value numeric(10, 2),
  next_action text check (next_action in ('llamar', 'volver_a_llamar', 'confirmar_cita', 'enviar_propuesta', 'hacer_upsell', 'cerrar_venta', 'ninguna')),
  next_action_date date,
  next_action_notes text,
  assigned_to uuid references public.employees (id) on delete set null,
  status text not null default 'activo' check (status in ('activo', 'ganado', 'perdido')),
  source text not null default 'manual' check (source in ('pagina_publica', 'manual', 'importado')),
  notes text,
  tags text[] not null default '{}',
  last_contact_date timestamptz,
  last_reminder_sent_date timestamptz,
  last_purchase_date timestamptz,
  last_reactivation_sent_date timestamptz,
  last_upsell_task_date timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- appointments
-- ------------------------------------------------------------
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  lead_id uuid references public.leads (id) on delete set null,
  service_id uuid references public.services (id) on delete set null,
  client_name text not null,
  client_email text,
  client_phone text,
  date date not null,
  time time not null,
  duration_minutes integer,
  service_name text,
  status text not null default 'pendiente' check (status in ('confirmada', 'pendiente', 'cancelada', 'completada', 'no_asistio')),
  notes text,
  materials_notes text,
  reminder_sent boolean not null default false,
  google_event_id text,
  ics_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Evita la doble reserva del mismo hueco (bug de Fase 1 del
-- proyecto viejo, aquí resuelto a nivel de base de datos)
create unique index appointments_no_double_booking
  on public.appointments (business_id, date, time)
  where status in ('pendiente', 'confirmada');

-- ------------------------------------------------------------
-- automations (plantillas de automatización DEL negocio;
-- el cron de plataforma vive en Vercel, ver vercel.json)
-- ------------------------------------------------------------
create table public.automations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  template_key text,
  name text not null,
  description text,
  trigger text not null check (trigger in ('cita_reservada', 'venta_cerrada', 'lead_inactivo', 'factura_vencida', 'cliente_inactivo', 'no_contesto', 'post_venta')),
  condition_days integer,
  action_type text not null check (action_type in ('enviar_email', 'crear_tarea', 'notificar_dueno')),
  email_subject text,
  email_body text,
  task_title text,
  is_active boolean not null default true,
  last_run timestamptz,
  runs_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index automations_unique_template
  on public.automations (business_id, template_key)
  where template_key is not null;

-- ------------------------------------------------------------
-- invoices
-- ------------------------------------------------------------
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  lead_id uuid references public.leads (id) on delete set null,
  invoice_number text,
  client_name text not null,
  client_email text,
  client_phone text,
  items jsonb not null default '[]'::jsonb,
  subtotal numeric(10, 2),
  tax_rate numeric(5, 2) not null default 21,
  tax_amount numeric(10, 2),
  total numeric(10, 2) not null,
  status text not null default 'borrador' check (status in ('borrador', 'enviada', 'cobrada', 'vencida', 'cancelada')),
  due_date date,
  paid_date date,
  notes text,
  owner_notified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- interactions
-- ------------------------------------------------------------
create table public.interactions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  lead_id uuid not null references public.leads (id) on delete cascade,
  type text not null check (type in ('llamada', 'email', 'reunion', 'nota', 'whatsapp', 'cita')),
  notes text,
  outcome text check (outcome in ('contestado', 'no_contestado', 'interesado', 'no_interesado', 'pendiente')),
  next_action text,
  next_action_date date,
  created_by uuid references auth.users (id) on delete set null,
  duration_minutes integer,
  task_created boolean not null default false,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- expenses
-- ------------------------------------------------------------
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  category text not null check (category in ('gastos_fijos', 'material', 'personal', 'marketing', 'otros')),
  subcategory text,
  description text not null,
  amount numeric(10, 2) not null,
  date date not null,
  is_recurring boolean not null default false,
  recurring_period text check (recurring_period in ('mensual', 'trimestral', 'anual')),
  receipt_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- tasks
-- ------------------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  lead_id uuid references public.leads (id) on delete set null,
  title text not null,
  description text,
  type text check (type in ('llamar', 'volver_a_llamar', 'enviar_email', 'confirmar_cita', 'hacer_upsell', 'otro')),
  due_date date not null,
  due_time time,
  priority text not null default 'media' check (priority in ('baja', 'media', 'alta', 'urgente')),
  status text not null default 'pendiente' check (status in ('pendiente', 'completada', 'cancelada')),
  assigned_to uuid references public.employees (id) on delete set null,
  created_by_automation boolean not null default false,
  lead_name text,
  lead_phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Índices de acceso frecuente
-- ------------------------------------------------------------
create index on public.employees (business_id);
create index on public.employees (user_id);
create index on public.services (business_id);
create index on public.leads (business_id);
create index on public.leads (business_id, status, pipeline_stage);
create index on public.appointments (business_id, date);
create index on public.appointments (date, status) where not reminder_sent;
create index on public.automations (business_id) where is_active;
create index on public.invoices (business_id, status);
create index on public.interactions (business_id, lead_id);
create index on public.expenses (business_id, date);
create index on public.tasks (business_id, status, due_date);

-- ------------------------------------------------------------
-- updated_at automático
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['businesses', 'employees', 'services', 'leads', 'appointments', 'automations', 'invoices', 'expenses', 'tasks']
  loop
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end;
$$;

-- ------------------------------------------------------------
-- Row Level Security (multi-tenancy real, a nivel de BD)
-- ------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.is_business_member(b_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select
    exists (select 1 from businesses b where b.id = b_id and b.owner_id = auth.uid())
    or exists (select 1 from employees e where e.business_id = b_id and e.user_id = auth.uid() and e.is_active)
    or public.is_admin();
$$;

alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.employees enable row level security;
alter table public.services enable row level security;
alter table public.leads enable row level security;
alter table public.appointments enable row level security;
alter table public.automations enable row level security;
alter table public.invoices enable row level security;
alter table public.interactions enable row level security;
alter table public.expenses enable row level security;
alter table public.tasks enable row level security;

-- profiles: cada uno el suyo; admin todos
create policy "own profile select" on public.profiles for select
  using (id = auth.uid() or public.is_admin());
create policy "own profile update" on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid() and role = 'user');
create policy "admin profile update" on public.profiles for update
  using (public.is_admin());

-- businesses: miembros ven; solo el dueño crea/edita; admin todo
create policy "member select" on public.businesses for select
  using (public.is_business_member(id));
create policy "owner insert" on public.businesses for insert
  with check (owner_id = auth.uid());
create policy "owner update" on public.businesses for update
  using (owner_id = auth.uid() or public.is_admin());
create policy "admin delete" on public.businesses for delete
  using (public.is_admin());

-- resto de tablas: acceso completo para miembros del negocio
do $$
declare t text;
begin
  foreach t in array array['employees', 'services', 'leads', 'appointments', 'automations', 'invoices', 'interactions', 'expenses', 'tasks']
  loop
    execute format('create policy "member all" on public.%I for all using (public.is_business_member(business_id)) with check (public.is_business_member(business_id))', t);
  end loop;
end;
$$;
