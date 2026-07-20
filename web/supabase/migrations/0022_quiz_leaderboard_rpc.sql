-- 0022: fecha vazamento multi-tenant da view quiz_leaderboard.
--
-- A view rodava com o privilégio do dono (comportamento padrão de view no
-- Postgres: RLS é avaliado como o dono do objeto, não como quem consulta),
-- então qualquer usuário autenticado podia chamar
-- GET /rest/v1/quiz_leaderboard?event_id=eq.<qualquer-uuid> e ver nome
-- completo + pontuação de participantes de QUALQUER evento de QUALQUER
-- cliente — furando tanto o RLS de quiz_answers (cada um só vê a própria
-- resposta) quanto o isolamento entre clientes. Substituída por RPC
-- security definer que exige has_event_role(event_id, 'quiz'|'reports'),
-- mesmo padrão de get_room_event/run_raffle.

revoke select on quiz_leaderboard from anon, authenticated;

create or replace function get_quiz_leaderboard(p_event_id uuid)
returns table (
  event_id uuid,
  user_id uuid,
  full_name text,
  correct_count bigint,
  score bigint
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not (has_event_role(p_event_id, 'quiz') or has_event_role(p_event_id, 'reports')) then
    raise exception 'Sem acesso ao ranking deste evento';
  end if;
  return query
    select l.event_id, l.user_id, l.full_name, l.correct_count, l.score
    from quiz_leaderboard l
    where l.event_id = p_event_id;
end;
$$;
