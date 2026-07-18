-- 0009: Fase E.1 — motor de atividades interativas (estilo Mentimeter)
-- Nuvem de palavras + enquete; modelo "slide ativo" (1 aberta por vez);
-- telão OBS via RPC pública; export identificado só para operadores.

-- ============================================================
-- Tabelas
-- ============================================================
create table activities (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  type text not null check (type in ('word_cloud', 'poll')),
  title text not null,
  -- poll: {"options": ["A","B"]} · word_cloud: {"max_entries": 3}
  config jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'open', 'closed')),
  -- resultado p/ participante: em tempo real OU só quando o diretor exibir
  results_visible text not null default 'live' check (results_visible in ('live', 'after_publish')),
  results_published boolean not null default false,
  -- destaque = abre em overlay sobre o vídeo na sala
  highlight boolean not null default false,
  -- fila de aprovação prévia (texto livre)
  require_moderation boolean not null default false,
  position integer not null default 0,
  opened_at timestamptz,
  created_at timestamptz not null default now()
);
create index activities_event_idx on activities(event_id);

create table activity_responses (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references activities(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  -- word_cloud: {"word": "..."} · poll: {"option_index": 0}
  payload jsonb not null,
  approved boolean not null default true,
  created_at timestamptz not null default now()
);
create index activity_responses_idx on activity_responses(activity_id, user_id);

-- Blocklist sempre ativa em texto livre (match por palavra inteira)
create table banned_words (word text primary key);
insert into banned_words (word) values
  ('merda'), ('bosta'), ('caralho'), ('porra'), ('puta'), ('puto'),
  ('viado'), ('buceta'), ('cu'), ('cuzao'), ('cuzão'), ('foda'), ('fodase'),
  ('foda-se'), ('fdp'), ('pqp'), ('vtnc'), ('vsf'), ('arrombado'),
  ('desgraça'), ('desgraca'), ('otario'), ('otário'), ('babaca'),
  ('idiota'), ('imbecil'), ('retardado'), ('macaco'), ('vagabunda'),
  ('piranha'), ('corno'), ('xoxota'), ('rola'), ('pinto'), ('penis'),
  ('pênis'), ('nazista'), ('hitler')
on conflict do nothing;

-- ============================================================
-- Agregação anônima de resultados (helper interno)
-- ============================================================
create or replace function activity_results(p_activity_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_activity activities%rowtype;
  v_result jsonb;
  v_total integer;
begin
  select * into v_activity from activities where id = p_activity_id;
  if not found then return null; end if;

  if v_activity.type = 'word_cloud' then
    select count(*) into v_total
      from activity_responses where activity_id = p_activity_id and approved;
    select coalesce(jsonb_agg(jsonb_build_object('word', word, 'count', cnt)
                              order by cnt desc, word), '[]'::jsonb)
      into v_result
      from (
        select payload->>'word' as word, count(*) as cnt
        from activity_responses
        where activity_id = p_activity_id and approved
        group by 1
        order by 2 desc
        limit 80
      ) w;
    return jsonb_build_object('type', 'word_cloud', 'total', v_total, 'words', v_result);
  else -- poll
    select count(*) into v_total
      from activity_responses where activity_id = p_activity_id and approved;
    select coalesce(jsonb_agg(cnt order by idx), '[]'::jsonb)
      into v_result
      from (
        select opts.idx,
               count(r.id) as cnt
        from jsonb_array_elements_text(coalesce(v_activity.config->'options', '[]'::jsonb))
             with ordinality as opts(opt, idx)
        left join activity_responses r
          on r.activity_id = p_activity_id and r.approved
         and (r.payload->>'option_index')::int = opts.idx - 1
        group by opts.idx
      ) c;
    return jsonb_build_object('type', 'poll', 'total', v_total, 'counts', v_result);
  end if;
end;
$$;

-- helper interno: não exposto via API
revoke execute on function activity_results(uuid) from public, anon, authenticated;

-- ============================================================
-- RPCs
-- ============================================================

-- Participante envia resposta (única forma de insert)
create or replace function submit_activity_response(p_activity_id uuid, p_payload jsonb)
returns activity_responses
language plpgsql security definer set search_path = public
as $$
declare
  v_activity activities%rowtype;
  v_word text;
  v_idx integer;
  v_max integer;
  v_row activity_responses;
  v_approved boolean := true;
begin
  select * into v_activity from activities where id = p_activity_id;
  if not found or v_activity.status <> 'open' then
    raise exception 'Esta atividade não está aberta';
  end if;
  if not (is_approved_participant(v_activity.event_id)
          or has_event_role(v_activity.event_id, 'quiz')) then
    raise exception 'Só participantes inscritos podem responder';
  end if;

  if v_activity.type = 'word_cloud' then
    v_word := lower(trim(regexp_replace(coalesce(p_payload->>'word', ''), '\s+', ' ', 'g')));
    if v_word = '' or length(v_word) > 30 then
      raise exception 'Palavra inválida (máx. 30 caracteres)';
    end if;
    if exists (select 1 from banned_words b where v_word ~* ('\m' || b.word || '\M')) then
      raise exception 'Palavra bloqueada pela moderação';
    end if;
    v_max := coalesce((v_activity.config->>'max_entries')::int, 3);
    if (select count(*) from activity_responses
        where activity_id = p_activity_id and user_id = auth.uid()) >= v_max then
      raise exception 'Limite de envios atingido';
    end if;
    if exists (select 1 from activity_responses
               where activity_id = p_activity_id and user_id = auth.uid()
                 and payload->>'word' = v_word) then
      raise exception 'Você já enviou esta palavra';
    end if;
    v_approved := not v_activity.require_moderation;
    insert into activity_responses (activity_id, user_id, payload, approved)
    values (p_activity_id, auth.uid(), jsonb_build_object('word', v_word), v_approved)
    returning * into v_row;
  else -- poll
    v_idx := (p_payload->>'option_index')::int;
    if v_idx is null or v_idx < 0
       or v_idx >= jsonb_array_length(coalesce(v_activity.config->'options', '[]'::jsonb)) then
      raise exception 'Opção inválida';
    end if;
    if exists (select 1 from activity_responses
               where activity_id = p_activity_id and user_id = auth.uid()) then
      raise exception 'Você já votou nesta enquete';
    end if;
    insert into activity_responses (activity_id, user_id, payload)
    values (p_activity_id, auth.uid(), jsonb_build_object('option_index', v_idx))
    returning * into v_row;
  end if;

  return v_row;
end;
$$;

-- Resultado agregado (anônimo) p/ sala e diretor
create or replace function get_activity_results(p_activity_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_activity activities%rowtype;
begin
  select * into v_activity from activities where id = p_activity_id;
  if not found then return null; end if;

  if not (
    has_event_role(v_activity.event_id, 'quiz')
    or has_event_role(v_activity.event_id, 'reports')
    or (is_approved_participant(v_activity.event_id)
        and v_activity.status in ('open', 'closed')
        and (v_activity.results_visible = 'live' or v_activity.results_published))
  ) then
    raise exception 'Sem permissão para ver o resultado';
  end if;

  return activity_results(p_activity_id);
end;
$$;

-- Controles do diretor (modelo "slide ativo": abrir fecha as demais)
create or replace function activity_control(p_activity_id uuid, p_action text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_event uuid;
begin
  select event_id into v_event from activities where id = p_activity_id;
  if v_event is null then raise exception 'Atividade não encontrada'; end if;
  if not has_event_role(v_event, 'quiz') then
    raise exception 'Sem permissão de quiz e interações';
  end if;

  if p_action = 'open' then
    update activities set status = 'closed'
      where event_id = v_event and status = 'open' and id <> p_activity_id;
    update activities set status = 'open', opened_at = now()
      where id = p_activity_id;
  elsif p_action = 'close' then
    update activities set status = 'closed'
      where id = p_activity_id and status = 'open';
  elsif p_action = 'publish' then
    update activities set results_published = true where id = p_activity_id;
  elsif p_action = 'unpublish' then
    update activities set results_published = false where id = p_activity_id;
  elsif p_action = 'clear' then
    delete from activity_responses where activity_id = p_activity_id;
    update activities
      set status = 'pending', results_published = false, opened_at = null
      where id = p_activity_id;
  else
    raise exception 'Ação inválida';
  end if;
end;
$$;

-- Telão OBS: estado público do evento (só agregados anônimos).
-- Callable por anon — o UUID do evento funciona como token da URL do telão.
create or replace function get_screen_state(p_event_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_activity activities%rowtype;
  v_event events%rowtype;
begin
  select * into v_event from events where id = p_event_id;
  if not found then return null; end if;

  select * into v_activity from activities
    where event_id = p_event_id and status = 'open'
    order by opened_at desc limit 1;
  if not found then
    select * into v_activity from activities
      where event_id = p_event_id and status = 'closed'
      order by opened_at desc nulls last limit 1;
  end if;

  return jsonb_build_object(
    'event', jsonb_build_object(
      'title', v_event.title,
      'brand_color', v_event.brand_color,
      'brand_logo_url', v_event.brand_logo_url,
      'bg_image_url', v_event.bg_image_url
    ),
    'activity', case when v_activity.id is null then null else jsonb_build_object(
      'id', v_activity.id,
      'type', v_activity.type,
      'title', v_activity.title,
      'status', v_activity.status,
      'config', v_activity.config
    ) end,
    'results', case when v_activity.id is null then null
                    else activity_results(v_activity.id) end
  );
end;
$$;

-- ============================================================
-- RLS
-- ============================================================
alter table activities enable row level security;
alter table activity_responses enable row level security;
alter table banned_words enable row level security; -- sem policies: só via funções

create policy "activities_operators_all" on activities for all
  using (has_event_role(event_id, 'quiz'))
  with check (has_event_role(event_id, 'quiz'));

create policy "activities_participant_select" on activities for select
  using (status in ('open', 'closed') and is_approved_participant(event_id));

-- respostas: participante vê as próprias; operadores veem tudo (export identificado)
create policy "activity_responses_own_select" on activity_responses for select
  using (user_id = auth.uid());

create policy "activity_responses_operators_select" on activity_responses for select
  using (exists (select 1 from activities a where a.id = activity_id
                 and (has_event_role(a.event_id, 'quiz') or has_event_role(a.event_id, 'reports'))));

-- moderação: aprovar (update) e remover (delete)
create policy "activity_responses_operators_update" on activity_responses for update
  using (exists (select 1 from activities a where a.id = activity_id
                 and has_event_role(a.event_id, 'quiz')));

create policy "activity_responses_operators_delete" on activity_responses for delete
  using (exists (select 1 from activities a where a.id = activity_id
                 and has_event_role(a.event_id, 'quiz')));

-- insert apenas via RPC submit_activity_response (security definer)

-- ============================================================
-- Realtime
-- ============================================================
alter publication supabase_realtime add table activities;
