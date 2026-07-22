-- ============================================================
-- Migração 0029: ambiente de teste compartilhado ("Teste agora")
-- Cliente demo fixo com um evento "modelo" (editado normalmente pelo
-- admin, nunca acessado por visitantes) e um evento "ao vivo" (id fixo,
-- é o que o organizador/participante demo usa de verdade) — a cada
-- reset agendado, o "ao vivo" é apagado e recriado a partir de uma
-- cópia fresca do "modelo". Assim quem configura o modelo pelo /admin
-- define o padrão, e o reset nunca apaga esse trabalho, só o que os
-- visitantes mexeram no evento ao vivo entre um reset e outro.
--
-- Pré-requisito: rodar `node scripts/seed-demo-users.mjs` ANTES desta
-- migração — ela referencia o perfil de demo@golive.net.br (created_by
-- do evento modelo) e o reset_demo_event() depende desse e-mail existir.
-- ============================================================

-- id fixo do evento "ao vivo" — usado também em web/src/app/demo/page.tsx
-- pro deep link direto ao Diretor. Gerado uma vez, nunca muda.
-- 727046b8-fe59-4690-a035-30e8d863aff7

-- ---------- CLIENTE DEMO ----------
insert into clients (slug, name, brand_color, folder_visibility, agency_id)
values ('demo', 'Cliente Demo', '#7C3AED', 'public', null)
on conflict (slug) do nothing;

-- ---------- EVENTO MODELO (editável pelo /admin, nunca acessado direto) ----------
insert into events (
  slug, title, description, status, stream_provider, stream_ref,
  access_mode, allowed_domains, google_login_enabled, capacity,
  chat_enabled, chat_moderation, brand_color, created_by, client_id,
  listed_on_client_page, accept_client_base, registration_mode,
  require_approval, allowlist_fallback_approval, consent_text,
  sponsor_logos, qa_enabled, qa_allow_anonymous, qa_upvote_enabled,
  gallery_enabled, presence_enabled, reactions_enabled,
  enabled_activity_types
)
select
  'evento-modelo', 'Evento Demo — GoLive',
  'Este é o modelo do evento de teste público. Configure aqui (marca, '
  || 'textos, quais interações ficam ligadas) — o evento "ao vivo" que '
  || 'os visitantes usam copia este modelo a cada reset automático.',
  'draft', 'youtube', 'mnKemC8HKjo',
  'open', '{}', true, 1000,
  true, false, '#7C3AED', p.id, c.id,
  false, false, 'open',
  false, false, '',
  '[]', true, true, true,
  true, true, true,
  array['word_cloud','poll','quiz','scale','open_text','ordering','matrix']
from clients c, profiles p
where c.slug = 'demo' and p.email = 'demo@golive.net.br'
on conflict (slug) do nothing;

-- ============================================================
-- reset_demo_event(): apaga e recria o evento "ao vivo" a partir do
-- modelo atual, copia campos extras e atividades simples, e restringe
-- a equipe do cliente demo só ao admin oficial.
-- ============================================================
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
    v_live_id, 'evento', title, description, cover_url, starts_at, ends_at,
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

-- popula o evento "ao vivo" pela primeira vez
select reset_demo_event();

-- ---------- RESET AGENDADO (pg_cron, de 4 em 4 horas) ----------
create extension if not exists pg_cron with schema extensions;

select cron.schedule(
  'reset-demo-event',
  '0 */4 * * *',
  $$select reset_demo_event()$$
);
