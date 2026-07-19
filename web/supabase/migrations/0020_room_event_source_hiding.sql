-- 0020: esconde stream_ref/stream_provider do payload inicial e do Realtime
-- bruto da tabela events. A sala passa a buscar o estado do evento via esta
-- RPC (polling autenticado), que só inclui a fonte do vídeo quando o evento
-- está 'live' e quem pede tem acesso (participante aprovado, operador ou
-- staff). Não impede ver a requisição na aba Network do DevTools (inerente
-- a qualquer embed) — apenas tira do HTML inicial e do broadcast do
-- Realtime, que hoje vaza a linha inteira a qualquer troca de status.

create or replace function get_room_event(p_event_id uuid)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select case
    when is_approved_participant(p_event_id)
      or has_event_role(p_event_id, 'chat')
      or has_event_role(p_event_id, 'quiz')
      or has_event_role(p_event_id, 'stream')
      or has_event_role(p_event_id, 'registrations')
      or has_event_role(p_event_id, 'reports')
      or is_staff()
    then case when e.status = 'live' then to_jsonb(e)
              else to_jsonb(e) - 'stream_ref' - 'stream_provider' end
    else null
  end
  from events e where e.id = p_event_id;
$$;
