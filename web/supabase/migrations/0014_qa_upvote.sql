-- 0014: Fase F — Q&A com upvote
-- Perguntas do público (identificadas ou anônimas), votos, moderação.

alter table events add column qa_enabled boolean not null default false;
alter table events add column qa_allow_anonymous boolean not null default true;
alter table events add column qa_moderation boolean not null default false;

create table questions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  author_id uuid not null references profiles(id) on delete cascade,
  -- denormalizado (padrão de posts); '' quando anônima — o nome real só sai no CSV
  author_name text not null default '',
  is_anonymous boolean not null default false,
  content text not null,
  status text not null default 'visible'
    check (status in ('pending', 'visible', 'answered', 'rejected')),
  votes_count integer not null default 0,
  created_at timestamptz not null default now()
);
create index questions_event_idx on questions(event_id, status);

create table question_votes (
  question_id uuid not null references questions(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (question_id, user_id)
);

-- contador denormalizado: mantém realtime simples (UPDATE em questions)
create or replace function sync_question_votes()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  update questions q
    set votes_count = (select count(*) from question_votes v where v.question_id = q.id)
    where q.id = coalesce(new.question_id, old.question_id);
  return null;
end;
$$;

create trigger question_votes_sync
after insert or delete on question_votes
for each row execute function sync_question_votes();

-- ============================================================
-- RPCs
-- ============================================================

-- Enviar pergunta (única forma de insert)
create or replace function submit_question(
  p_event_id uuid,
  p_content text,
  p_anonymous boolean default false
)
returns questions
language plpgsql security definer set search_path = public
as $$
declare
  v_event events%rowtype;
  v_content text;
  v_name text;
  v_row questions;
begin
  select * into v_event from events where id = p_event_id;
  if not found or not v_event.qa_enabled then
    raise exception 'Perguntas não estão habilitadas neste evento';
  end if;
  if not (is_approved_participant(p_event_id) or has_event_role(p_event_id, 'chat')) then
    raise exception 'Só participantes inscritos podem perguntar';
  end if;

  v_content := trim(regexp_replace(coalesce(p_content, ''), '\s+', ' ', 'g'));
  if v_content = '' or length(v_content) > 300 then
    raise exception 'Pergunta inválida (máx. 300 caracteres)';
  end if;
  if exists (select 1 from banned_words b where v_content ~* ('\m' || b.word || '\M')) then
    raise exception 'Pergunta bloqueada pela moderação';
  end if;
  if p_anonymous and not v_event.qa_allow_anonymous then
    raise exception 'Perguntas anônimas não são permitidas neste evento';
  end if;

  if p_anonymous then
    v_name := '';
  else
    select coalesce(full_name, '') into v_name from profiles where id = auth.uid();
  end if;

  insert into questions (event_id, author_id, author_name, is_anonymous, content, status)
  values (p_event_id, auth.uid(), v_name, p_anonymous, v_content,
          case when v_event.qa_moderation then 'pending' else 'visible' end)
  returning * into v_row;
  return v_row;
end;
$$;

-- Upvote (toggle): vota se não votou, retira se já votou
create or replace function toggle_question_vote(p_question_id uuid)
returns boolean -- true = voto registrado, false = voto removido
language plpgsql security definer set search_path = public
as $$
declare
  v_event uuid;
begin
  select event_id into v_event from questions
    where id = p_question_id and status in ('visible', 'answered');
  if v_event is null then
    raise exception 'Pergunta não disponível';
  end if;
  if not (is_approved_participant(v_event) or has_event_role(v_event, 'chat')) then
    raise exception 'Só participantes inscritos podem votar';
  end if;

  delete from question_votes
    where question_id = p_question_id and user_id = auth.uid();
  if found then
    return false;
  end if;
  insert into question_votes (question_id, user_id)
  values (p_question_id, auth.uid());
  return true;
end;
$$;

-- ============================================================
-- RLS
-- ============================================================
alter table questions enable row level security;
alter table question_votes enable row level security;

-- participante vê perguntas públicas + as próprias (acompanha moderação)
create policy "questions_select" on questions for select
  using (
    (status in ('visible', 'answered') and is_approved_participant(event_id))
    or author_id = auth.uid()
    or has_event_role(event_id, 'chat')
    or has_event_role(event_id, 'reports')
  );

-- moderação: aprovar/marcar respondida/rejeitar (update) e apagar (delete)
create policy "questions_operators_update" on questions for update
  using (has_event_role(event_id, 'chat'));
create policy "questions_operators_delete" on questions for delete
  using (has_event_role(event_id, 'chat'));

-- insert apenas via submit_question (security definer)

-- votos: cada um enxerga os próprios (p/ marcar o ▲); contagem vem de votes_count
create policy "question_votes_select_own" on question_votes for select
  using (user_id = auth.uid());

-- insert/delete apenas via toggle_question_vote (security definer)

-- ============================================================
-- Realtime
-- ============================================================
alter publication supabase_realtime add table questions;
