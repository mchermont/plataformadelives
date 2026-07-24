-- Intérprete de Libras: overlay PIP separado do palco, até 2 alternando.
alter table studio_rooms
  add column active_interpreter_id varchar(255) default null,
  add column interpreter_position varchar(20) not null default 'bottom-right';

-- Convidados/intérpretes não têm permissão de UPDATE em studio_rooms (RLS
-- exige has_event_role(_,'stream')/admin) — RPC dedicada, mesmo padrão das
-- outras escritas públicas do projeto (submit_activity_response etc.),
-- pro intérprete conseguir "assumir" sozinho sem ser staff autenticado.
create or replace function set_active_interpreter(p_event_id uuid, p_identity text)
returns void
language sql
security definer
set search_path = public
as $$
  update studio_rooms
  set active_interpreter_id = p_identity
  where event_id = p_event_id;
$$;

grant execute on function set_active_interpreter(uuid, text) to anon, authenticated;
