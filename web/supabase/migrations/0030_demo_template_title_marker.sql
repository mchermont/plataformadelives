-- ============================================================
-- Migração 0030: corrige confusão de nome entre o evento "modelo" e o
-- evento "ao vivo" do ambiente de teste (0029) — os dois ficaram com o
-- mesmo título na lista do /admin, impossível de diferenciar. O modelo
-- agora carrega um marcador visível só nele; reset_demo_event() tira
-- esse marcador ao copiar o título pro evento "ao vivo" (participante
-- nunca vê "[MODELO]").
-- ============================================================

update events
set title = '[MODELO — edite aqui] Evento Demo — GoLive'
where slug = 'evento-modelo' and title = 'Evento Demo — GoLive';

create or replace function reset_demo_event()
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_live_id uuid := '727046b8-fe59-4690-a035-30e8d863aff7';
  v_template_id uuid;
  v_client_id uuid;
  v_admin_id uuid;
begin
  select id into v_template_id from events where slug = 'evento-modelo';
  select id into v_client_id from clients where slug = 'demo';
  select id into v_admin_id from profiles where email = 'demo@golive.net.br';

  if v_template_id is null or v_client_id is null or v_admin_id is null then
    raise exception 'Ambiente demo incompleto (rode seed-demo-users.mjs antes)';
  end if;

  -- apaga o evento ao vivo (cascade cuida de chat/quiz/fotos/sorteios/inscrições/etc)
  delete from events where id = v_live_id;

  insert into events (
    id, slug, title, description, cover_url, starts_at, ends_at, status,
    stream_provider, stream_ref, access_mode, allowed_domains,
    google_login_enabled, capacity, chat_enabled, chat_moderation,
    brand_logo_url, brand_color, created_by, client_id,
    listed_on_client_page, accept_client_base, registration_mode,
    require_approval, allowlist_fallback_approval, consent_text,
    bg_image_url, bg_image_mobile_url, card_image_url, sponsor_logos,
    qa_enabled, qa_allow_anonymous, qa_upvote_enabled, gallery_enabled,
    presence_enabled, reactions_enabled, enabled_activity_types
  )
  select
    v_live_id, 'evento',
    regexp_replace(title, '^\[MODELO[^\]]*\]\s*', ''),
    description, cover_url, starts_at, ends_at,
    'live',
    stream_provider, stream_ref, access_mode, allowed_domains,
    google_login_enabled, capacity, chat_enabled, chat_moderation,
    brand_logo_url, brand_color, created_by, client_id,
    false, accept_client_base, registration_mode,
    require_approval, allowlist_fallback_approval, consent_text,
    bg_image_url, bg_image_mobile_url, card_image_url, sponsor_logos,
    qa_enabled, qa_allow_anonymous, qa_upvote_enabled, gallery_enabled,
    presence_enabled, reactions_enabled, enabled_activity_types
  from events where id = v_template_id;

  -- campos de cadastro personalizados do modelo
  insert into event_fields (event_id, label, field_type, required, options, position)
  select v_live_id, label, field_type, required, options, position
  from event_fields where event_id = v_template_id;

  -- atividades simples (word_cloud/poll/scale/open_text/ordering/matrix) —
  -- quiz fica de fora por depender de quizzes/quiz_questions à parte
  insert into activities (
    event_id, type, title, config, status, results_visible,
    results_published, highlight, require_moderation, position
  )
  select
    v_live_id, type, title, config, 'pending', results_visible,
    false, highlight, require_moderation, position
  from activities
  where event_id = v_template_id and type not in ('quiz', 'quiz_ranking');

  -- equipe do cliente demo: só o admin oficial sobrevive ao reset
  delete from client_members
    where client_id = v_client_id and user_id <> v_admin_id;
  insert into client_members (client_id, user_id, role)
  values (v_client_id, v_admin_id, 'admin')
  on conflict (client_id, user_id) do update set role = 'admin';

  -- convites pendentes de terceiros pro cliente demo não sobrevivem
  delete from client_invites where client_id = v_client_id;
end;
$$;

-- resincroniza o evento ao vivo já sem o marcador no título
select reset_demo_event();
