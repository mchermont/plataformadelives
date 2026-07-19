-- 0019: Fase H — sorteio também na sala (overlay sobre o player)
-- RPC leve para a sala consultar o sorteio em exibição (a get_screen_state
-- calcula resultados de atividade — pesada demais para polling por
-- participante). Mesma forma pública do telão: só agregados/resultado.

create or replace function get_displayed_raffle(p_event_id uuid)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'id', r.id,
    'kind', r.kind,
    'visual', r.visual,
    'title', r.title,
    'result', r.result,
    'total_entries', case when r.kind = 'participants'
                          then jsonb_array_length(r.entries)
                          else null end
  )
  from raffles r
  where r.event_id = p_event_id and r.displayed
  order by r.created_at desc
  limit 1;
$$;
