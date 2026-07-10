-- WhatsApp incoming messages log for auto-response webhook

create table if not exists public.whatsapp_incoming_messages (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  phone text not null,
  message text not null,
  matched_keyword text,
  auto_responded boolean not null default false,
  responded_at timestamp with time zone,
  created_at timestamp with time zone not null default now()
);

-- RLS: businesses can see their own incoming messages
alter table public.whatsapp_incoming_messages enable row level security;

create policy "businesses_see_own_incoming"
  on public.whatsapp_incoming_messages
  for select
  using (
    auth.uid() = (select owner_id from public.businesses where id = business_id)
  );

-- Indexes for auditing and rate-limiting
create index idx_whatsapp_incoming_business_created
  on public.whatsapp_incoming_messages(business_id, created_at desc);

create index idx_whatsapp_incoming_phone_created
  on public.whatsapp_incoming_messages(phone, created_at desc);
