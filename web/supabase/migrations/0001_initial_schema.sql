-- ============================================================
-- Plataforma de Lives — schema inicial
-- Migração 0001: identidade, eventos, acesso, feed e quiz
-- ============================================================

-- ---------- ENUMS ----------
create type event_status as enum ('draft', 'scheduled', 'live', 'ended');
create type stream_provider as enum ('youtube', 'vimeo', 'dacast', 'hls');
create type access_mode as enum ('open', 'approval', 'domain');
create type registration_status as enum ('pending', 'approved', 'rejected', 'banned');
create type field_type as enum ('text', 'select', 'checkbox');
create type post_kind as enum ('message', 'announcement');
create type quiz_status as enum ('draft', 'active', 'closed');
create type question_status as enum ('pending', 'open', 'closed', 'revealed');

-- ---------- PROFILES ----------
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text not null default '',   -- espelho de auth.users.email, para o painel admin
  avatar_url text,
  is_platform_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- Cria o profile automaticamente quando um usuário se cadastra no Auth
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.email, ''),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------- EVENTS ----------
create table events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,64}$'),
  title text not null,
  description text not null default '',
  cover_url text,
  starts_at timestamptz,
  ends_at timestamptz,
  status event_status not null default 'draft',
  -- vídeo
  stream_provider stream_provider not null default 'youtube',
  stream_ref text not null default '',   -- ID do vídeo (yt/vimeo), URL do embed (dacast) ou manifesto HLS
  -- acesso
  access_mode access_mode not null default 'open',
  allowed_domains text[] not null default '{}',
  google_login_enabled boolean not null default true,
  capacity integer not null default 1000 check (capacity > 0),
  -- módulos
  chat_enabled boolean not null default true,
  quiz_enabled boolean not null default true,
  created_by uuid not null references profiles (id),
  created_at timestamptz not null default now()
);

-- Campos de cadastro personalizados por evento
create table event_fields (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  label text not null,
  field_type field_type not null default 'text',
  required boolean not null default false,
  options jsonb not null default '[]',   -- alternativas quando field_type = select
  position integer not null default 0
);
create index event_fields_event_idx on event_fields (event_id, position);

-- ---------- REGISTRATIONS ----------
create table registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  status registration_status not null default 'pending',
  answers jsonb not null default '{}',   -- { event_field_id: valor }
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);
create index registrations_event_status_idx on registrations (event_id, status);

-- Inscrição com regra de acesso aplicada no banco (fonte da verdade)
create or replace function register_for_event(p_event_id uuid, p_answers jsonb default '{}')
returns registrations
language plpgsql
security definer set search_path = public
as $$
declare
  v_event events%rowtype;
  v_email text;
  v_domain text;
  v_status registration_status;
  v_existing registrations%rowtype;
  v_row registrations;
begin
  select * into v_event from events where id = p_event_id and status <> 'draft';
  if not found then
    raise exception 'Evento não encontrado';
  end if;

  select email into v_email from auth.users where id = auth.uid();
  if v_email is null then
    raise exception 'Não autenticado';
  end if;

  -- Quem já foi banido ou rejeitado não se reinscreve
  select * into v_existing
    from registrations where event_id = p_event_id and user_id = auth.uid();
  if found and v_existing.status in ('rejected', 'banned') then
    raise exception 'Inscrição não permitida';
  end if;

  v_domain := lower(split_part(v_email, '@', 2));

  if v_event.access_mode = 'open' then
    v_status := 'approved';
  elsif v_event.access_mode = 'approval' then
    v_status := 'pending';
  else -- domain
    if v_domain = any (v_event.allowed_domains) then
      v_status := 'approved';
    else
      raise exception 'Domínio de e-mail não autorizado para este evento';
    end if;
  end if;

  insert into registrations (event_id, user_id, status, answers)
  values (p_event_id, auth.uid(), v_status, p_answers)
  on conflict (event_id, user_id) do update set answers = excluded.answers
  returning * into v_row;

  return v_row;
end;
$$;

-- ---------- FEED / CHAT ----------
create table posts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  author_id uuid not null references profiles (id),
  author_name text not null default '',  -- desnormalizado: evita expor a tabela profiles
  content text not null check (char_length(content) between 1 and 2000),
  kind post_kind not null default 'message',
  pinned boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);
create index posts_event_created_idx on posts (event_id, created_at desc);

-- Preenche author_name no insert a partir do profile (cliente não controla)
create or replace function set_post_author_name()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  select full_name into new.author_name from profiles where id = new.author_id;
  return new;
end;
$$;

create trigger posts_set_author_name
  before insert on posts
  for each row execute function set_post_author_name();

-- ---------- QUIZ ----------
create table quizzes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  title text not null,
  status quiz_status not null default 'draft',
  created_at timestamptz not null default now()
);

-- Perguntas: NÃO contêm a resposta certa (ver quiz_keys).
-- revealed_correct_index só é preenchido quando o admin revela.
create table quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references quizzes (id) on delete cascade,
  prompt text not null,
  options jsonb not null default '[]',       -- ["alternativa A", "alternativa B", ...]
  time_limit_sec integer not null default 30 check (time_limit_sec between 5 and 600),
  position integer not null default 0,
  status question_status not null default 'pending',
  opened_at timestamptz,
  revealed_correct_index integer
);
create index quiz_questions_quiz_idx on quiz_questions (quiz_id, position);

-- Gabarito: tabela separada, legível apenas por admin.
-- Mantém a resposta fora do payload do Realtime e de selects de participantes.
create table quiz_keys (
  question_id uuid primary key references quiz_questions (id) on delete cascade,
  correct_index integer not null
);

create table quiz_answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references quiz_questions (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  selected_index integer not null,
  answered_at timestamptz not null default now(),
  unique (question_id, user_id)
);

-- Responder pergunta: valida janela de tempo e status no banco
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
  if v_q.opened_at + make_interval(secs => v_q.time_limit_sec) < now() then
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

-- Controle ao vivo (admin): abrir, fechar e revelar pergunta
create or replace function open_question(p_question_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not is_admin() then raise exception 'Apenas admin'; end if;
  update quiz_questions
    set status = 'open', opened_at = now()
    where id = p_question_id and status = 'pending';
end;
$$;

create or replace function close_question(p_question_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not is_admin() then raise exception 'Apenas admin'; end if;
  update quiz_questions set status = 'closed'
    where id = p_question_id and status = 'open';
end;
$$;

create or replace function reveal_question(p_question_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not is_admin() then raise exception 'Apenas admin'; end if;
  update quiz_questions q
    set status = 'revealed',
        revealed_correct_index = k.correct_index
    from quiz_keys k
    where q.id = p_question_id and k.question_id = q.id and q.status = 'closed';
end;
$$;

-- Ranking do quiz: acerto vale 1000 + bônus por velocidade (até 500)
create or replace view quiz_leaderboard as
select
  q.event_id,
  a.user_id,
  p.full_name,
  count(*) filter (where a.selected_index = k.correct_index) as correct_count,
  sum(
    case when a.selected_index = k.correct_index then
      1000 + greatest(0, 500 - (extract(epoch from (a.answered_at - qq.opened_at)) * 500 / qq.time_limit_sec))::int
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
-- RLS
-- ============================================================
alter table profiles enable row level security;
alter table events enable row level security;
alter table event_fields enable row level security;
alter table registrations enable row level security;
alter table posts enable row level security;
alter table quizzes enable row level security;
alter table quiz_questions enable row level security;
alter table quiz_keys enable row level security;
alter table quiz_answers enable row level security;

create or replace function is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select is_platform_admin from profiles where id = auth.uid()), false);
$$;

create or replace function is_approved_participant(p_event_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from registrations
    where event_id = p_event_id and user_id = auth.uid() and status = 'approved'
  );
$$;

-- profiles: cada um vê/edita o seu; admin vê todos
create policy "profiles_select_own_or_admin" on profiles for select
  using (id = auth.uid() or is_admin());
create policy "profiles_update_own" on profiles for update
  using (id = auth.uid()) with check (id = auth.uid() and is_platform_admin = false);

-- events: publicados são visíveis (página de entrada precisa dos metadados); admin gerencia
create policy "events_select_published" on events for select
  using (status <> 'draft' or is_admin());
create policy "events_admin_write" on events for all
  using (is_admin()) with check (is_admin());

-- event_fields: visíveis com o evento; admin gerencia
create policy "event_fields_select" on event_fields for select
  using (exists (select 1 from events e where e.id = event_id and (e.status <> 'draft' or is_admin())));
create policy "event_fields_admin_write" on event_fields for all
  using (is_admin()) with check (is_admin());

-- registrations: participante vê a própria; admin vê/gerencia todas.
-- Inserção só via função register_for_event (security definer).
create policy "registrations_select_own_or_admin" on registrations for select
  using (user_id = auth.uid() or is_admin());
create policy "registrations_admin_write" on registrations for all
  using (is_admin()) with check (is_admin());

-- posts: participantes aprovados leem e escrevem no evento; admin modera
create policy "posts_select_participant" on posts for select
  using ((deleted_at is null and is_approved_participant(event_id)) or is_admin());
create policy "posts_insert_participant" on posts for insert
  with check (
    author_id = auth.uid()
    and kind = 'message'
    and pinned = false
    and is_approved_participant(event_id)
    and exists (select 1 from events e where e.id = event_id and e.chat_enabled and e.status = 'live')
  );
create policy "posts_admin_all" on posts for all
  using (is_admin()) with check (is_admin());

-- quizzes/perguntas: participantes aprovados leem quando ativo; admin gerencia
create policy "quizzes_select" on quizzes for select
  using ((status <> 'draft' and is_approved_participant(event_id)) or is_admin());
create policy "quizzes_admin_write" on quizzes for all
  using (is_admin()) with check (is_admin());

create policy "quiz_questions_select" on quiz_questions for select
  using (
    is_admin() or (
      status <> 'pending'
      and exists (
        select 1 from quizzes q
        where q.id = quiz_id and q.status <> 'draft' and is_approved_participant(q.event_id)
      )
    )
  );
create policy "quiz_questions_admin_write" on quiz_questions for all
  using (is_admin()) with check (is_admin());

-- quiz_keys: gabarito é exclusivo do admin
create policy "quiz_keys_admin_only" on quiz_keys for all
  using (is_admin()) with check (is_admin());

-- quiz_answers: cada um vê a própria; inserção só via answer_question()
create policy "quiz_answers_select_own_or_admin" on quiz_answers for select
  using (user_id = auth.uid() or is_admin());
create policy "quiz_answers_admin_write" on quiz_answers for all
  using (is_admin()) with check (is_admin());

-- Realtime: publicar mudanças das tabelas usadas ao vivo
alter publication supabase_realtime add table posts;
alter publication supabase_realtime add table quiz_questions;
alter publication supabase_realtime add table registrations;
alter publication supabase_realtime add table events;
