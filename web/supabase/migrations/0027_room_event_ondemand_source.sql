-- ============================================================
-- Migração 0027: get_room_event também libera stream_ref/stream_provider
-- quando o evento está 'ondemand' — senão a sala nunca recebe a fonte do
-- vídeo pra tocar a gravação (a função só previa 'live', migração 0020).
-- ============================================================

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
    then case when e.status in ('live', 'ondemand') then to_jsonb(e)
              else to_jsonb(e) - 'stream_ref' - 'stream_provider' end
    else null
  end
  from events e where e.id = p_event_id;
$$;
