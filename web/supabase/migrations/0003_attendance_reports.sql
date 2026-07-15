-- ============================================================
-- Migração 0003: registro de presença (base dos relatórios)
-- ============================================================

-- Quem de fato entrou na sala do evento, quando e por quanto tempo.
-- Alimentada por heartbeat do cliente a cada 60s via RPC touch_attendance.
create table event_attendance (
  event_id uuid not null references events (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  first_joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  watch_seconds integer not null default 0,
  primary key (event_id, user_id)
);

alter table event_attendance enable row level security;

create policy "attendance_select_own_or_staff" on event_attendance for select
  using (user_id = auth.uid() or is_staff());
-- Escrita apenas pela RPC (security definer)

create or replace function touch_attendance(p_event_id uuid, p_seconds integer default 60)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_seconds integer := greatest(0, least(coalesce(p_seconds, 60), 300));
begin
  if auth.uid() is null then
    raise exception 'Não autenticado';
  end if;

  -- Participante aprovado ou equipe
  if not (is_staff() or exists (
    select 1 from registrations
    where event_id = p_event_id and user_id = auth.uid() and status = 'approved'
  )) then
    raise exception 'Sem acesso ao evento';
  end if;

  insert into event_attendance (event_id, user_id, watch_seconds)
  values (p_event_id, auth.uid(), 0)
  on conflict (event_id, user_id) do update
    set last_seen_at = now(),
        watch_seconds = event_attendance.watch_seconds + v_seconds;
end;
$$;
