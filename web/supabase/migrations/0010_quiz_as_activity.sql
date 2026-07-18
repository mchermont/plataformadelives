-- 0010: Quiz entra no motor de atividades (lotes de perguntas) + ranking geral
-- "Abrir" a atividade abre todas as perguntas pendentes do quiz de uma vez;
-- "Fechar" encerra o lote; "Exibir resultado" revela gabarito + ranking.

-- ============================================================
-- Novos tipos + vínculo com quizzes
-- ============================================================
alter table activities drop constraint activities_type_check;
alter table activities add constraint activities_type_check
  check (type in ('word_cloud', 'poll', 'quiz', 'quiz_ranking'));

alter table activities add column quiz_id uuid references quizzes(id) on delete cascade;
create unique index activities_quiz_idx on activities(quiz_id) where quiz_id is not null;

-- Perguntas de quiz-atividade não têm cronômetro próprio (0 = fecha com o lote)
alter table quiz_questions drop constraint quiz_questions_time_limit_sec_check;
alter table quiz_questions add constraint quiz_questions_time_limit_sec_check
  check (time_limit_sec = 0 or time_limit_sec between 5 and 600);

-- Quizzes existentes viram atividades (compat com eventos antigos)
insert into activities (event_id, type, title, quiz_id, results_visible, highlight, position)
select q.event_id, 'quiz', q.title, q.id, 'after_publish', true,
       coalesce((select max(a2.position) + 1 from activities a2 where a2.event_id = q.event_id), 0)
from quizzes q
where not exists (select 1 from activities a where a.quiz_id = q.id);

-- ============================================================
-- answer_question: aceita pergunta sem cronômetro
-- ============================================================
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

-- Placar: sem cronômetro não há bônus de velocidade (1000 fixo por acerto)
create or replace view quiz_leaderboard as
select
  q.event_id,
  a.user_id,
  p.full_name,
  count(*) filter (where a.selected_index = k.correct_index) as correct_count,
  sum(
    case when a.selected_index = k.correct_index then
      1000 + case when qq.time_limit_sec > 0 then
        greatest(0, 500 - (extract(epoch from (a.answered_at - qq.opened_at)) * 500 / qq.time_limit_sec))::int
      else 0 end
    else 0 end
  ) as score
from quiz_answers a
join quiz_questions qq on qq.id = a.question_id
join quiz_keys k on k.question_id = qq.id
join quizzes q on q.id = qq.quiz_id
join profiles p on p.id = a.user_id
where qq.status in ('closed', 'revealed')
group by q.event_id, a.user_id, p.full_name;

-- ============================================================
-- Resultados agregados: tipos quiz e quiz_ranking
-- ============================================================
create or replace function activity_results(p_activity_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_activity activities%rowtype;
  v_result jsonb;
  v_ranking jsonb;
  v_total integer;
begin
  select * into v_activity from activities where id = p_activity_id;
  if not found then return null; end if;

  if v_activity.type = 'word_cloud' then
    select count(*) into v_total
      from activity_responses where activity_id = p_activity_id and approved;
    select coalesce(jsonb_agg(jsonb_build_object('word', word, 'count', cnt)
                              order by cnt desc, word), '[]'::jsonb)
      into v_result
      from (
        select payload->>'word' as word, count(*) as cnt
        from activity_responses
        where activity_id = p_activity_id and approved
        group by 1
        order by 2 desc
        limit 80
      ) w;
    return jsonb_build_object('type', 'word_cloud', 'total', v_total, 'words', v_result);

  elsif v_activity.type = 'poll' then
    select count(*) into v_total
      from activity_responses where activity_id = p_activity_id and approved;
    select coalesce(jsonb_agg(cnt order by idx), '[]'::jsonb)
      into v_result
      from (
        select opts.idx, count(r.id) as cnt
        from jsonb_array_elements_text(coalesce(v_activity.config->'options', '[]'::jsonb))
             with ordinality as opts(opt, idx)
        left join activity_responses r
          on r.activity_id = p_activity_id and r.approved
         and (r.payload->>'option_index')::int = opts.idx - 1
        group by opts.idx
      ) c;
    return jsonb_build_object('type', 'poll', 'total', v_total, 'counts', v_result);

  elsif v_activity.type = 'quiz' then
    -- participantes distintos que responderam algo neste quiz
    select count(distinct a.user_id) into v_total
      from quiz_answers a
      join quiz_questions qq on qq.id = a.question_id
      where qq.quiz_id = v_activity.quiz_id;

    -- perguntas lançadas (distribuição sempre; gabarito/acertos só após revelar)
    select coalesce(jsonb_agg(qjson order by pos), '[]'::jsonb) into v_result
    from (
      select qq.position as pos, jsonb_build_object(
        'id', qq.id,
        'prompt', qq.prompt,
        'options', qq.options,
        'status', qq.status,
        'correct_index', qq.revealed_correct_index,
        'total', (select count(*) from quiz_answers a where a.question_id = qq.id),
        'counts', (
          select coalesce(jsonb_agg(cnt order by idx), '[]'::jsonb)
          from (
            select opts.idx, count(a.id) as cnt
            from jsonb_array_elements_text(qq.options) with ordinality as opts(opt, idx)
            left join quiz_answers a
              on a.question_id = qq.id and a.selected_index = opts.idx - 1
            group by opts.idx
          ) c),
        'correct_count', case when qq.revealed_correct_index is not null then
          (select count(*) from quiz_answers a
           where a.question_id = qq.id
             and a.selected_index = qq.revealed_correct_index) end
      ) as qjson
      from quiz_questions qq
      where qq.quiz_id = v_activity.quiz_id and qq.status <> 'pending'
    ) qs;

    -- ranking DESTE quiz — só perguntas reveladas (não vaza gabarito de lote fechado)
    select coalesce(jsonb_agg(jsonb_build_object(
             'name', full_name, 'score', score, 'correct', correct)
             order by score desc), '[]'::jsonb) into v_ranking
    from (
      select p.full_name,
             count(*) filter (where a.selected_index = qq.revealed_correct_index) as correct,
             coalesce(sum(case when a.selected_index = qq.revealed_correct_index
                               then 1000 else 0 end), 0) as score
      from quiz_answers a
      join quiz_questions qq on qq.id = a.question_id
      join profiles p on p.id = a.user_id
      where qq.quiz_id = v_activity.quiz_id and qq.status = 'revealed'
      group by p.id, p.full_name
      order by score desc, correct desc
      limit 10
    ) r;

    return jsonb_build_object('type', 'quiz', 'total', v_total,
                              'questions', v_result, 'ranking', v_ranking);

  else -- quiz_ranking: placar geral de todos os quizzes da live
    select count(*) into v_total
      from quiz_leaderboard where event_id = v_activity.event_id;
    select coalesce(jsonb_agg(jsonb_build_object(
             'name', full_name, 'score', score, 'correct', correct_count)
             order by score desc), '[]'::jsonb) into v_ranking
    from (
      select full_name, score, correct_count
      from quiz_leaderboard
      where event_id = v_activity.event_id
      order by score desc, correct_count desc
      limit 10
    ) l;
    return jsonb_build_object('type', 'quiz_ranking', 'total', v_total,
                              'ranking', v_ranking);
  end if;
end;
$$;

revoke execute on function activity_results(uuid) from public, anon, authenticated;

-- ============================================================
-- Controles do diretor: quiz abre/fecha/revela por LOTE
-- ============================================================
create or replace function activity_control(p_activity_id uuid, p_action text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_activity activities%rowtype;
begin
  select * into v_activity from activities where id = p_activity_id;
  if not found then raise exception 'Atividade não encontrada'; end if;
  if not has_event_role(v_activity.event_id, 'quiz') then
    raise exception 'Sem permissão de quiz e interações';
  end if;

  if p_action = 'open' then
    -- slide ativo: fecha a atividade aberta (e o lote de quiz dela, se houver)
    update quiz_questions qq set status = 'closed'
      from activities a
      where a.event_id = v_activity.event_id and a.status = 'open'
        and a.id <> p_activity_id and a.quiz_id = qq.quiz_id
        and qq.status = 'open';
    update activities set status = 'closed'
      where event_id = v_activity.event_id and status = 'open' and id <> p_activity_id;

    update activities set status = 'open', opened_at = now()
      where id = p_activity_id;
    if v_activity.quiz_id is not null then
      update quizzes set status = 'active' where id = v_activity.quiz_id;
      -- abre o lote: todas as perguntas ainda pendentes
      update quiz_questions set status = 'open', opened_at = now()
        where quiz_id = v_activity.quiz_id and status = 'pending';
    end if;

  elsif p_action = 'close' then
    update activities set status = 'closed'
      where id = p_activity_id and status = 'open';
    if v_activity.quiz_id is not null then
      update quiz_questions set status = 'closed'
        where quiz_id = v_activity.quiz_id and status = 'open';
    end if;

  elsif p_action = 'publish' then
    if v_activity.quiz_id is not null then
      -- revela o gabarito das perguntas fechadas
      update quiz_questions q
        set status = 'revealed', revealed_correct_index = k.correct_index
        from quiz_keys k
        where q.quiz_id = v_activity.quiz_id and k.question_id = q.id
          and q.status = 'closed';
    end if;
    update activities set results_published = true where id = p_activity_id;

  elsif p_action = 'unpublish' then
    update activities set results_published = false where id = p_activity_id;

  elsif p_action = 'clear' then
    delete from activity_responses where activity_id = p_activity_id;
    if v_activity.quiz_id is not null then
      delete from quiz_answers where question_id in
        (select id from quiz_questions where quiz_id = v_activity.quiz_id);
      update quiz_questions
        set status = 'pending', opened_at = null, revealed_correct_index = null
        where quiz_id = v_activity.quiz_id;
      update quizzes set status = 'draft' where id = v_activity.quiz_id;
    end if;
    update activities
      set status = 'pending', results_published = false, opened_at = null
      where id = p_activity_id;

  else
    raise exception 'Ação inválida';
  end if;
end;
$$;

-- Respostas de quiz entram por answer_question (pontuação), não por aqui
create or replace function submit_activity_response(p_activity_id uuid, p_payload jsonb)
returns activity_responses
language plpgsql security definer set search_path = public
as $$
declare
  v_activity activities%rowtype;
  v_word text;
  v_idx integer;
  v_max integer;
  v_row activity_responses;
  v_approved boolean := true;
begin
  select * into v_activity from activities where id = p_activity_id;
  if not found or v_activity.status <> 'open' then
    raise exception 'Esta atividade não está aberta';
  end if;
  if v_activity.type not in ('word_cloud', 'poll') then
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
  else -- poll
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
  end if;

  return v_row;
end;
$$;
