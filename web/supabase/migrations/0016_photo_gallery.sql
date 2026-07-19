-- 0016: Fase G.2 — Galeria de fotos dos participantes
-- Upload pelos participantes com moderação OBRIGATÓRIA (nada aparece sem
-- aprovação). Bucket próprio 'gallery' com limites de tamanho/formato no
-- Storage; o que é exibido é controlado pela tabela event_photos (RLS).

alter table events add column gallery_enabled boolean not null default false;

create table event_photos (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  author_id uuid not null references profiles(id) on delete cascade,
  -- desnormalizado (padrão de posts): painel de moderação não expõe profiles
  author_name text not null default '',
  storage_path text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);
create index event_photos_event_idx on event_photos(event_id, status);

-- Bucket público: a URL contém UUIDs (não adivinhável) e a exibição pública
-- passa pela tabela; limite 10 MB e só imagens exibíveis no navegador.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gallery', 'gallery', true, 10485760,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Caminho: <event_id>/<user_id>/<uuid>.<ext>
create policy "gallery_public_read" on storage.objects
  for select using (bucket_id = 'gallery');
create policy "gallery_participant_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'gallery'
    and (storage.foldername(name))[2] = auth.uid()::text
    and (
      is_approved_participant(((storage.foldername(name))[1])::uuid)
      or has_event_role(((storage.foldername(name))[1])::uuid, 'chat')
    )
  );
create policy "gallery_operator_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'gallery'
    and has_event_role(((storage.foldername(name))[1])::uuid, 'chat')
  );

-- Registro do envio (única forma de insert); sempre entra pendente
create or replace function submit_photo(p_event_id uuid, p_path text)
returns event_photos
language plpgsql security definer set search_path = public
as $$
declare
  v_enabled boolean;
  v_name text;
  v_row event_photos;
begin
  select gallery_enabled into v_enabled from events where id = p_event_id;
  if not coalesce(v_enabled, false) then
    raise exception 'Galeria não está habilitada neste evento';
  end if;
  if not (is_approved_participant(p_event_id) or has_event_role(p_event_id, 'chat')) then
    raise exception 'Só participantes inscritos podem enviar fotos';
  end if;
  if p_path not like p_event_id || '/' || auth.uid() || '/%' then
    raise exception 'Caminho de arquivo inválido';
  end if;
  if (select count(*) from event_photos
      where event_id = p_event_id and author_id = auth.uid()
        and status <> 'rejected') >= 10 then
    raise exception 'Limite de 10 fotos por participante';
  end if;

  select coalesce(full_name, '') into v_name from profiles where id = auth.uid();

  insert into event_photos (event_id, author_id, author_name, storage_path)
  values (p_event_id, auth.uid(), v_name, p_path)
  returning * into v_row;
  return v_row;
end;
$$;

-- ============================================================
-- RLS
-- ============================================================
alter table event_photos enable row level security;

-- participante vê aprovadas + as próprias (acompanha moderação);
-- moderação usa can_chat (convenção do produto); reports enxerga p/ relatório
create policy "photos_select" on event_photos for select
  using (
    (status = 'approved' and is_approved_participant(event_id))
    or author_id = auth.uid()
    or has_event_role(event_id, 'chat')
    or has_event_role(event_id, 'reports')
  );

create policy "photos_operators_update" on event_photos for update
  using (has_event_role(event_id, 'chat'));
create policy "photos_operators_delete" on event_photos for delete
  using (has_event_role(event_id, 'chat'));
-- autor pode remover a própria foto
create policy "photos_delete_own" on event_photos for delete
  using (author_id = auth.uid());

-- ============================================================
-- Realtime
-- ============================================================
alter publication supabase_realtime add table event_photos;
