-- 0013: Fase E.3 — matrix 2×2 (itens avaliados em dois eixos, média plotada)

alter table activities drop constraint activities_type_check;
alter table activities add constraint activities_type_check
  check (type in ('word_cloud', 'poll', 'quiz', 'quiz_ranking',
                  'scale', 'open_text', 'ordering', 'matrix'));

-- ============================================================
-- submit_activity_response: + matrix
--   matrix: payload {"xs": [..], "ys": [..]} (1 par por item, 1..scale_max)
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

-- ============================================================
-- activity_results: + matrix (média de x/y por item)
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
  v_scale_max integer;
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

  elsif v_activity.type = 'scale' then
    v_scale_max := coalesce((v_activity.config->>'scale_max')::int, 5);
    select count(*) into v_total
      from activity_responses where activity_id = p_activity_id and approved;
    select coalesce(jsonb_agg(sjson order by sidx), '[]'::jsonb) into v_result
    from (
      select s.sidx, jsonb_build_object(
        'statement', s.statement,
        'avg', (select round(avg((r.payload->'ratings'->>(s.sidx - 1)::int)::numeric), 2)
                from activity_responses r
                where r.activity_id = p_activity_id and r.approved),
        'count', (select count(*) from activity_responses r
                  where r.activity_id = p_activity_id and r.approved),
        'dist', (
          select coalesce(jsonb_agg(cnt order by val), '[]'::jsonb)
          from (
            select v.val, count(r2.id) as cnt
            from generate_series(1, v_scale_max) v(val)
            left join activity_responses r2
              on r2.activity_id = p_activity_id and r2.approved
             and (r2.payload->'ratings'->>(s.sidx - 1)::int)::int = v.val
            group by v.val
          ) d)
      ) as sjson
      from jsonb_array_elements_text(coalesce(v_activity.config->'statements', '[]'::jsonb))
           with ordinality s(statement, sidx)
    ) x;
    return jsonb_build_object('type', 'scale', 'total', v_total,
                              'scale_max', v_scale_max, 'statements', v_result);

  elsif v_activity.type = 'open_text' then
    select count(*) into v_total
      from activity_responses where activity_id = p_activity_id and approved;
    select coalesce(jsonb_agg(jsonb_build_object('id', id, 'text', txt)
                              order by ts desc), '[]'::jsonb) into v_result
    from (
      select id, payload->>'text' as txt, created_at as ts
      from activity_responses
      where activity_id = p_activity_id and approved
      order by created_at desc
      limit 60
    ) e;
    return jsonb_build_object('type', 'open_text', 'total', v_total,
      'entries', v_result,
      'spotlight', (
        select jsonb_build_object('id', id, 'text', payload->>'text')
        from activity_responses
        where id = nullif(v_activity.config->>'spotlight', '')::uuid and approved
      ));

  elsif v_activity.type = 'ordering' then
    select count(*) into v_total
      from activity_responses where activity_id = p_activity_id and approved;
    select coalesce(jsonb_agg(jsonb_build_object(
             'option', opt, 'index', idx - 1, 'avg_pos', avgpos)
             order by avgpos nulls last, idx), '[]'::jsonb) into v_result
    from (
      select opts.idx, opts.opt,
             (select round(avg(o.ord), 2)
              from activity_responses r,
                   jsonb_array_elements_text(r.payload->'order') with ordinality o(val, ord)
              where r.activity_id = p_activity_id and r.approved
                and o.val::int = opts.idx - 1) as avgpos
      from jsonb_array_elements_text(coalesce(v_activity.config->'options', '[]'::jsonb))
           with ordinality opts(opt, idx)
    ) x;
    return jsonb_build_object('type', 'ordering', 'total', v_total, 'order', v_result);

  elsif v_activity.type = 'matrix' then
    v_scale_max := coalesce((v_activity.config->>'scale_max')::int, 5);
    select count(*) into v_total
      from activity_responses where activity_id = p_activity_id and approved;
    select coalesce(jsonb_agg(jsonb_build_object(
             'option', opt, 'index', idx - 1,
             'avg_x', ax, 'avg_y', ay)
             order by idx), '[]'::jsonb) into v_result
    from (
      select opts.idx, opts.opt,
             (select round(avg((r.payload->'xs'->>(opts.idx - 1)::int)::numeric), 2)
              from activity_responses r
              where r.activity_id = p_activity_id and r.approved) as ax,
             (select round(avg((r.payload->'ys'->>(opts.idx - 1)::int)::numeric), 2)
              from activity_responses r
              where r.activity_id = p_activity_id and r.approved) as ay
      from jsonb_array_elements_text(coalesce(v_activity.config->'options', '[]'::jsonb))
           with ordinality opts(opt, idx)
    ) x;
    return jsonb_build_object('type', 'matrix', 'total', v_total,
                              'scale_max', v_scale_max, 'items', v_result);

  elsif v_activity.type = 'quiz' then
    select count(distinct a.user_id) into v_total
      from quiz_answers a
      join quiz_questions qq on qq.id = a.question_id
      where qq.quiz_id = v_activity.quiz_id;

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

  else -- quiz_ranking
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
