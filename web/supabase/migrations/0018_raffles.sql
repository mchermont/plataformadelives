-- 0018: Fase H — Sorteios auditáveis
-- Sorteio server-side com semente aleatória e algoritmo determinístico
-- (ganhador = menores md5(semente || chave)): qualquer um pode reconferir o
-- resultado a partir do log (estilo Sorteador UFSCar). A tabela não tem
-- policy de UPDATE — o registro é imutável (exibição via RPC definer).

create table raffles (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  kind text not null check (kind in ('participants', 'numbers', 'coin')),
  visual text not null default 'cards' check (visual in ('cards', 'wheel', 'coin')),
  title text not null default '',
  config jsonb not null default '{}'::jsonb,
  seed text not null,
  -- snapshot dos elegíveis no momento do sorteio (auditoria)
  entries jsonb not null default '[]'::jsonb,
  result jsonb not null default '[]'::jsonb,
  displayed boolean not null default false,
  drawn_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index raffles_event_idx on raffles(event_id, created_at desc);

-- ============================================================
-- Sorteio (única forma de insert)
-- ============================================================
create or replace function run_raffle(
  p_event_id uuid,
  p_kind text,
  p_title text default '',
  p_config jsonb default '{}'::jsonb,
  p_visual text default 'cards'
)
returns raffles
language plpgsql security definer set search_path = public
as $$
declare
  v_seed text := md5(gen_random_uuid()::text || clock_timestamp()::text);
  v_entries jsonb := '[]'::jsonb;
  v_result jsonb := '[]'::jsonb;
  v_winners integer := greatest(1, coalesce((p_config->>'winners')::integer, 1));
  v_source text := coalesce(p_config->>'source', 'registrations');
  v_exclude_team boolean := coalesce((p_config->>'exclude_team')::boolean, true);
  v_exclude_winners boolean := coalesce((p_config->>'exclude_winners')::boolean, false);
  v_excluded jsonb := '[]'::jsonb;
  v_min integer; v_max integer; v_count integer;
  v_visual text := p_visual;
  v_row raffles;
begin
  if not has_event_role(p_event_id, 'quiz') then
    raise exception 'Sem permissão para sortear neste evento';
  end if;

  if p_kind = 'coin' then
    v_visual := 'coin';
    v_result := to_jsonb(array[
      case when ('x' || substr(v_seed, 1, 8))::bit(32)::int % 2 = 0
           then 'Cara' else 'Coroa' end
    ]);

  elsif p_kind = 'numbers' then
    v_min := coalesce((p_config->>'min')::integer, 1);
    v_max := coalesce((p_config->>'max')::integer, 100);
    v_count := greatest(1, coalesce((p_config->>'count')::integer, 1));
    if v_max <= v_min or v_max - v_min > 100000 then
      raise exception 'Intervalo inválido (máx. 100.000 números)';
    end if;
    if coalesce((p_config->>'exclude_drawn')::boolean, false) then
      select coalesce(jsonb_agg(n), '[]'::jsonb) into v_excluded
      from (select distinct jsonb_array_elements_text(r.result)::integer n
            from raffles r
            where r.event_id = p_event_id and r.kind = 'numbers') t;
    end if;
    select coalesce(jsonb_agg(w.n order by w.ord), '[]'::jsonb) into v_result
    from (
      select n, row_number() over (order by md5(v_seed || n::text)) ord
      from generate_series(v_min, v_max) n
      where not exists (
        select 1 from jsonb_array_elements_text(v_excluded) e where e::integer = n)
    ) w
    where w.ord <= v_count;
    if jsonb_array_length(v_result) < v_count then
      raise exception 'Não há números suficientes no intervalo (sem repetição)';
    end if;
    v_entries := jsonb_build_object('min', v_min, 'max', v_max, 'excluded', v_excluded);

  elsif p_kind = 'participants' then
    if v_visual not in ('cards', 'wheel') then v_visual := 'cards'; end if;

    if v_source = 'list' then
      select coalesce(jsonb_agg(jsonb_build_object('key', t.name, 'name', t.name)), '[]'::jsonb)
      into v_entries
      from (select distinct trim(value) as name
            from jsonb_array_elements_text(coalesce(p_config->'list', '[]'::jsonb))
            where trim(value) <> '') t;
    elsif v_source = 'attendance' then
      -- presentes na sala agora (heartbeat renova a cada 60s)
      select coalesce(jsonb_agg(jsonb_build_object(
               'key', a.user_id, 'name', coalesce(nullif(p.full_name, ''), 'Participante'))), '[]'::jsonb)
      into v_entries
      from event_attendance a join profiles p on p.id = a.user_id
      where a.event_id = p_event_id
        and a.last_seen_at > now() - interval '5 minutes';
    else
      select coalesce(jsonb_agg(jsonb_build_object(
               'key', r.user_id, 'name', coalesce(nullif(p.full_name, ''), 'Participante'))), '[]'::jsonb)
      into v_entries
      from registrations r join profiles p on p.id = r.user_id
      where r.event_id = p_event_id and r.status = 'approved';
    end if;

    -- exclusões: equipe do evento/cliente e ganhadores anteriores
    if v_exclude_team and v_source <> 'list' then
      select coalesce(jsonb_agg(e), '[]'::jsonb) into v_entries
      from jsonb_array_elements(v_entries) e
      where not exists (
              select 1 from event_members em
              where em.event_id = p_event_id and em.user_id = (e->>'key')::uuid)
        and not exists (
              select 1 from events ev
              join client_members cm on cm.client_id = ev.client_id
              where ev.id = p_event_id and cm.user_id = (e->>'key')::uuid);
    end if;
    if v_exclude_winners then
      select coalesce(jsonb_agg(e), '[]'::jsonb) into v_entries
      from jsonb_array_elements(v_entries) e
      where not exists (
        select 1 from raffles r2, jsonb_array_elements(r2.result) w
        where r2.event_id = p_event_id and r2.kind = 'participants'
          and w->>'key' = e->>'key');
    end if;

    if jsonb_array_length(v_entries) < v_winners then
      raise exception 'Elegíveis insuficientes: % para % ganhador(es), já contando as exclusões',
        jsonb_array_length(v_entries), v_winners;
    end if;
    select coalesce(jsonb_agg(t.e order by t.ord), '[]'::jsonb) into v_result
    from (
      select e, row_number() over (order by md5(v_seed || (e->>'key'))) ord
      from jsonb_array_elements(v_entries) e
    ) t
    where t.ord <= v_winners;

  else
    raise exception 'Tipo de sorteio inválido';
  end if;

  insert into raffles (event_id, kind, visual, title, config, seed, entries, result, drawn_by)
  values (
    p_event_id, p_kind, v_visual,
    coalesce(nullif(trim(p_title), ''),
      case p_kind when 'numbers' then 'Sorteio de números'
                  when 'coin' then 'Cara ou coroa'
                  else 'Sorteio' end),
    p_config, v_seed, v_entries, v_result, auth.uid()
  )
  returning * into v_row;
  return v_row;
end;
$$;

-- Exibir/ocultar no telão (1 por vez, sem policy de update na tabela)
create or replace function raffle_display(p_raffle_id uuid, p_show boolean)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_event uuid;
begin
  select event_id into v_event from raffles where id = p_raffle_id;
  if v_event is null or not has_event_role(v_event, 'quiz') then
    raise exception 'Sem permissão';
  end if;
  update raffles set displayed = false
    where event_id = v_event and id <> p_raffle_id and displayed;
  update raffles set displayed = p_show where id = p_raffle_id;
end;
$$;

-- ============================================================
-- Telão: inclui o sorteio exibido no estado público
-- ============================================================
create or replace function get_screen_state(p_event_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_activity activities%rowtype;
  v_event events%rowtype;
  v_raffle raffles%rowtype;
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

  select * into v_raffle from raffles
    where event_id = p_event_id and displayed
    order by created_at desc limit 1;

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
                    else activity_results(v_activity.id) end,
    'raffle', case when v_raffle.id is null then null else jsonb_build_object(
      'id', v_raffle.id,
      'kind', v_raffle.kind,
      'visual', v_raffle.visual,
      'title', v_raffle.title,
      'result', v_raffle.result,
      'total_entries', case when v_raffle.kind = 'participants'
                            then jsonb_array_length(v_raffle.entries)
                            else null end
    ) end
  );
end;
$$;

-- ============================================================
-- RLS: leitura p/ operadores; sem UPDATE (imutável); delete p/ housekeeping
-- ============================================================
alter table raffles enable row level security;

create policy "raffles_operators_select" on raffles for select
  using (has_event_role(event_id, 'quiz') or has_event_role(event_id, 'reports'));
create policy "raffles_operators_delete" on raffles for delete
  using (has_event_role(event_id, 'quiz'));
