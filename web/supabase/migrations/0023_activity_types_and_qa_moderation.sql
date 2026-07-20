-- 0023: Interações por tipo de atividade + Q&A com aprovação obrigatória.
--
-- quiz_enabled não gateava nada em runtime (só existia no formulário) —
-- substituído por enabled_activity_types, que passa a controlar de fato
-- quais tipos de atividade o evento pode usar (EventForm + RLS de
-- activities). Q&A deixa de ter moderação opcional: toda pergunta entra
-- pending e só aparece ao público após aprovação do colaborador — decisão
-- de produto (perguntas ao vivo/posteriores exigem curadoria). Upvote
-- passa a ser configurável por evento.

alter table events add column enabled_activity_types text[] not null default
  array['word_cloud','poll','quiz','scale','open_text','ordering','matrix'];
alter table events drop column quiz_enabled;

alter table events add column qa_upvote_enabled boolean not null default true;
alter table events drop column qa_moderation;

-- submit_question: aprovação deixa de ser condicional
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
  values (p_event_id, auth.uid(), v_name, p_anonymous, v_content, 'pending')
  returning * into v_row;
  return v_row;
end;
$$;

-- toggle_question_vote: bloqueia se o evento desligou upvote
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
  if not (select qa_upvote_enabled from events where id = v_event) then
    raise exception 'Votação não está habilitada neste evento';
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

-- activities: só cria/edita tipos habilitados no evento (defesa em
-- profundidade além do filtro na UI do Diretor)
drop policy "activities_operators_all" on activities;
create policy "activities_operators_all" on activities for all
  using (has_event_role(event_id, 'quiz'))
  with check (
    has_event_role(event_id, 'quiz')
    and exists (
      select 1 from events e
      where e.id = activities.event_id
        and (
          activities.type = any(e.enabled_activity_types)
          or (activities.type = 'quiz_ranking' and 'quiz' = any(e.enabled_activity_types))
        )
    )
  );
