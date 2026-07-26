-- Multistream RTMP: destinos cadastrados pelo Diretor (YouTube, Instagram,
-- RTMP genérico) pra onde o Egress do LiveKit manda a saída do Estúdio.
-- Guarda credenciais (chave de stream) — diferente de studio_assets/
-- studio_rooms, aqui NÃO existe policy de leitura pública/anônima: só
-- staff com permissão 'stream' ou admin do cliente/plataforma lê e escreve.
create table if not exists public.studio_stream_destinations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name varchar(100) not null,
  rtmp_url text not null,
  stream_key text not null,
  enabled boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_studio_stream_destinations_event_id
  on public.studio_stream_destinations(event_id);

alter table public.studio_stream_destinations enable row level security;

create policy studio_stream_destinations_all_staff on public.studio_stream_destinations
  for all to authenticated
  using (
    public.has_event_role(event_id, 'stream') or
    exists (
      select 1 from public.events e
      join public.client_members cm on cm.client_id = e.client_id
      where e.id = studio_stream_destinations.event_id and cm.user_id = auth.uid() and cm.role = 'admin'
    ) or
    public.is_admin()
  );

drop trigger if exists set_studio_stream_destinations_updated_at on public.studio_stream_destinations;
create trigger set_studio_stream_destinations_updated_at
  before update on public.studio_stream_destinations
  for each row execute function public.handle_updated_at();

-- Estado do job de Egress ATIVO (um só por evento — manda pra todos os
-- destinos habilitados de uma vez, não um job por destino).
alter table public.studio_rooms
  add column egress_id varchar(255) default null,
  add column egress_status varchar(20) default null
    check (egress_status is null or egress_status in ('starting','active','stopping','error')),
  add column egress_error text default null;
