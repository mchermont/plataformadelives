-- 0017: Fase G.3 — Materiais do evento para download
-- Organizador sobe arquivos (PPT, PDF, vídeo, imagem, áudio) e controla
-- quais estão visíveis e quando. A aba na sala só aparece se houver
-- material visível (sem flag no evento).

create table event_materials (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  title text not null,
  storage_path text not null,
  file_name text not null,
  file_size bigint not null default 0,
  mime_type text not null default '',
  visible boolean not null default false,
  added_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index event_materials_event_idx on event_materials(event_id, visible);

-- Bucket público (URL com UUIDs; visibilidade controlada pela tabela).
-- 100 MB por arquivo; sem restrição de tipo (envio é só da equipe).
insert into storage.buckets (id, name, public, file_size_limit)
values ('materials', 'materials', true, 104857600)
on conflict (id) do nothing;

-- Caminho: <event_id>/<uuid>-<nome do arquivo>
-- Gestão espelha events_operators_update: equipe do evento (stream) ou gestor
create policy "materials_public_read" on storage.objects
  for select using (bucket_id = 'materials');
create policy "materials_operator_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'materials'
    and (
      can_manage_event(((storage.foldername(name))[1])::uuid)
      or has_event_role(((storage.foldername(name))[1])::uuid, 'stream')
    )
  );
create policy "materials_operator_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'materials'
    and (
      can_manage_event(((storage.foldername(name))[1])::uuid)
      or has_event_role(((storage.foldername(name))[1])::uuid, 'stream')
    )
  );

-- ============================================================
-- RLS
-- ============================================================
alter table event_materials enable row level security;

create policy "materials_select" on event_materials for select
  using (
    (visible and is_approved_participant(event_id))
    or can_manage_event(event_id)
    or has_event_role(event_id, 'stream')
  );

create policy "materials_operator_write" on event_materials for all
  using (can_manage_event(event_id) or has_event_role(event_id, 'stream'))
  with check (can_manage_event(event_id) or has_event_role(event_id, 'stream'));

-- ============================================================
-- Realtime
-- ============================================================
alter publication supabase_realtime add table event_materials;
