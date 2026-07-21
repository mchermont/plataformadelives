-- ============================================================
-- Migração 0025: trava interações de participante quando o evento
-- encerra. Chat já bloqueava via RLS (posts_insert_participant exige
-- status = 'live', migração 0001) — as RPCs de escrita não bloqueavam.
-- Defesa em profundidade: a UI já esconde os controles quando o evento
-- está encerrado, isso aqui cobre quem chama a RPC direto.
-- ============================================================

create or replace function submit_activity_response(p_activity_id uuid, p_payload jsonb)
returns activity_responses
language plpgsql security definer set search_path = public
as $$
declare
  v_activity activities%rowtype;
  v_word text;
  v_text text;
  v_idx integer;
  v_max integer;
  v_n integer;
  v_scale_max integer;
  v_row activity_responses;
  v_approved boolean := true;
begin
  select * into v_activity from activities where id = p_activity_id;
  if not found or v_activity.status <> 'open' then
    raise exception 'Esta atividade não está aberta';
  end if;
  if not exists (select 1 from events where id = v_activity.event_id and status = 'live') then
    raise exception 'Este evento já foi encerrado.';
  end if;
  if v_activity.type in ('quiz', 'quiz_ranking') then
    raise exception 'Este tipo de atividade não aceita respostas diretas';
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

  elsif v_activity.type = 'poll' then
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

  elsif v_activity.type = 'scale' then
    v_n := jsonb_array_length(coalesce(v_activity.config->'statements', '[]'::jsonb));
    v_scale_max := coalesce((v_activity.config->>'scale_max')::int, 5);
    if jsonb_array_length(coalesce(p_payload->'ratings', '[]'::jsonb)) <> v_n then
      raise exception 'Avalie todas as afirmações';
    end if;
    if exists (
      select 1 from jsonb_array_elements_text(p_payload->'ratings') v
      where v.value !~ '^\d+$' or v.value::int < 1 or v.value::int > v_scale_max
    ) then
      raise exception 'Valor fora da escala';
    end if;
    if exists (select 1 from activity_responses
               where activity_id = p_activity_id and user_id = auth.uid()) then
      raise exception 'Você já respondeu esta atividade';
    end if;
    insert into activity_responses (activity_id, user_id, payload)
    values (p_activity_id, auth.uid(),
            jsonb_build_object('ratings', p_payload->'ratings'))
    returning * into v_row;

  elsif v_activity.type = 'open_text' then
    v_text := trim(regexp_replace(coalesce(p_payload->>'text', ''), '\s+', ' ', 'g'));
    if v_text = '' or length(v_text) > 200 then
      raise exception 'Resposta inválida (máx. 200 caracteres)';
    end if;
    if exists (select 1 from banned_words b where v_text ~* ('\m' || b.word || '\M')) then
      raise exception 'Resposta bloqueada pela moderação';
    end if;
    v_max := coalesce((v_activity.config->>'max_entries')::int, 3);
    if (select count(*) from activity_responses
        where activity_id = p_activity_id and user_id = auth.uid()) >= v_max then
      raise exception 'Limite de envios atingido';
    end if;
    v_approved := not v_activity.require_moderation;
    insert into activity_responses (activity_id, user_id, payload, approved)
    values (p_activity_id, auth.uid(), jsonb_build_object('text', v_text), v_approved)
    returning * into v_row;

  elsif v_activity.type = 'matrix' then
    v_n := jsonb_array_length(coalesce(v_activity.config->'options', '[]'::jsonb));
    v_scale_max := coalesce((v_activity.config->>'scale_max')::int, 5);
    if jsonb_array_length(coalesce(p_payload->'xs', '[]'::jsonb)) <> v_n
       or jsonb_array_length(coalesce(p_payload->'ys', '[]'::jsonb)) <> v_n then
      raise exception 'Avalie todos os itens';
    end if;
    if exists (
      select 1 from (
        select value from jsonb_array_elements_text(p_payload->'xs')
        union all
        select value from jsonb_array_elements_text(p_payload->'ys')
      ) v
      where v.value !~ '^\d+$' or v.value::int < 1 or v.value::int > v_scale_max
    ) then
      raise exception 'Valor fora da escala';
    end if;
    if exists (select 1 from activity_responses
               where activity_id = p_activity_id and user_id = auth.uid()) then
      raise exception 'Você já respondeu esta atividade';
    end if;
    insert into activity_responses (activity_id, user_id, payload)
    values (p_activity_id, auth.uid(),
            jsonb_build_object('xs', p_payload->'xs', 'ys', p_payload->'ys'))
    returning * into v_row;

  else -- ordering
    v_n := jsonb_array_length(coalesce(v_activity.config->'options', '[]'::jsonb));
    if jsonb_array_length(coalesce(p_payload->'order', '[]'::jsonb)) <> v_n
       or (select array_agg(v.value::int order by v.value::int)
           from jsonb_array_elements_text(p_payload->'order') v)
          is distinct from
          (select array_agg(g) from generate_series(0, v_n - 1) g) then
      raise exception 'Ordenação inválida';
    end if;
    if exists (select 1 from activity_responses
               where activity_id = p_activity_id and user_id = auth.uid()) then
      raise exception 'Você já enviou sua ordenação';
    end if;
    insert into activity_responses (activity_id, user_id, payload)
    values (p_activity_id, auth.uid(),
            jsonb_build_object('order', p_payload->'order'))
    returning * into v_row;
  end if;

  return v_row;
end;
$$;

create or replace function answer_question(p_question_id uuid, p_selected integer)
returns quiz_answers
language plpgsql
security definer set search_path = public
as $$
declare
  v_q quiz_questions%rowtype;
  v_event_id uuid;
  v_row quiz_answers;
begin
  select * into v_q from quiz_questions where id = p_question_id;
  if not found or v_q.status <> 'open' then
    raise exception 'Pergunta não está aberta';
  end if;
  if v_q.time_limit_sec > 0
     and v_q.opened_at + make_interval(secs => v_q.time_limit_sec) < now() then
    raise exception 'Tempo esgotado';
  end if;

  select event_id into v_event_id from quizzes where id = v_q.quiz_id;
  if not exists (select 1 from events where id = v_event_id and status = 'live') then
    raise exception 'Este evento já foi encerrado.';
  end if;
  if not exists (
    select 1 from registrations
    where event_id = v_event_id and user_id = auth.uid() and status = 'approved'
  ) then
    raise exception 'Sem inscrição aprovada neste evento';
  end if;

  insert into quiz_answers (question_id, user_id, selected_index)
  values (p_question_id, auth.uid(), p_selected)
  returning * into v_row;

  return v_row;
end;
$$;

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
  if v_event.status <> 'live' then
    raise exception 'Este evento já foi encerrado.';
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
  if not exists (select 1 from events where id = v_event and status = 'live') then
    raise exception 'Este evento já foi encerrado.';
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

create or replace function submit_photo(p_event_id uuid, p_path text)
returns event_photos
language plpgsql security definer set search_path = public
as $$
declare
  v_event events%rowtype;
  v_name text;
  v_row event_photos;
begin
  select * into v_event from events where id = p_event_id;
  if not found or not v_event.gallery_enabled then
    raise exception 'Galeria não está habilitada neste evento';
  end if;
  if v_event.status <> 'live' then
    raise exception 'Este evento já foi encerrado.';
  end if;
  if not (is_approved_participant(p_event_id) or has_event_role(p_event_id, 'chat')) then
    raise exception 'Só participantes inscritos podem enviar fotos';
  end if;
  if p_path not like p_event_id || '/' || auth.uid() || '/%' then
    raise exception 'Caminho de arquivo inválido';
  end if;
  if (select count(*) from event_photos
      where event_id = p_event_id and author_id = auth.uid()
        and status <> 'rejected') >= 10 then
    raise exception 'Limite de 10 fotos por participante';
  end if;

  select coalesce(full_name, '') into v_name from profiles where id = auth.uid();

  insert into event_photos (event_id, author_id, author_name, storage_path)
  values (p_event_id, auth.uid(), v_name, p_path)
  returning * into v_row;
  return v_row;
end;
$$;
