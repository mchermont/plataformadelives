-- ============================================================
-- Migração 0004: fundação multi-tenant (v2)
-- Agências, clientes ("pastas" estilo Drive), membros e convites,
-- funções por evento, novos modos de cadastro, allowlist e LGPD
-- ============================================================

-- ---------- AGÊNCIAS (camada opcional) ----------
create table agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- ---------- CLIENTES (a "pasta" pública /slug/) ----------
create type folder_visibility as enum ('public', 'restricted', 'private');

create table clients (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid references agencies (id),
  name text not null,
  slug text not null unique check (
    slug ~ '^[a-z0-9-]{2,40}$'
    and slug not in ('admin','login','logout','auth','api','e','c','static',
                     'assets','sair','entrar','cadastro','senha','eventos')
  ),
  folder_visibility folder_visibility not null default 'private',
  brand_color text not null default '#0284c7' check (brand_color ~ '^#[0-9a-fA-F]{6}$'),
  brand_logo_url text,
  bg_image_url text,
  bg_image_mobile_url text,
  created_at timestamptz not null default now()
);

-- ---------- MEMBROS DO CLIENTE (estilo Google Drive) ----------
create type client_role as enum ('admin', 'collaborator');

create table client_members (
  client_id uuid not null references clients (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  role client_role not null default 'collaborator',
  created_at timestamptz not null default now(),
  primary key (client_id, user_id)
);

-- Convites pendentes: ativam sozinhos quando a pessoa criar a conta
create table client_invites (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients (id) on delete cascade,
  email text not null,
  role client_role not null default 'collaborator',
  invited_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  unique (client_id, email)
);

create or replace function activate_pending_invites()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into client_members (client_id, user_id, role)
  select ci.client_id, new.id, ci.role
  from client_invites ci
  where lower(ci.email) = lower(new.email) and ci.accepted_at is null
  on conflict (client_id, user_id) do nothing;

  update client_invites set accepted_at = now()
  where lower(email) = lower(new.email) and accepted_at is null;

  return new;
end;
$$;

create trigger profiles_activate_invites
  after insert on profiles
  for each row execute function activate_pending_invites();

-- ---------- FUNÇÕES POR EVENTO (as 5 caixas) ----------
create table event_members (
  event_id uuid not null references events (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  can_stream boolean not null default false,
  can_chat boolean not null default false,
  can_quiz boolean not null default false,
  can_registrations boolean not null default false,
  can_reports boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

-- ---------- EVENTOS: vínculo com cliente, página e novos modos ----------
create type registration_mode as enum ('open', 'allowlist', 'domain');

alter table events
  add column client_id uuid references clients (id),
  add column listed_on_client_page boolean not null default true,
  add column accept_client_base boolean not null default false,
  add column registration_mode registration_mode not null default 'open',
  add column require_approval boolean not null default false,
  add column allowlist_fallback_approval boolean not null default false,
  add column consent_text text not null default '',
  add column bg_image_url text,
  add column bg_image_mobile_url text,
  add column card_image_url text,
  add column sponsor_logos jsonb not null default '[]';

-- Migra os modos antigos para os novos campos
update events set
  registration_mode = case when access_mode = 'domain'
    then 'domain'::registration_mode else 'open'::registration_mode end,
  require_approval = (access_mode = 'approval');

-- Compatibilidade: enquanto o app antigo gravar access_mode em updates,
-- espelha nos campos novos (removível quando o app v2 estiver no ar)
create or replace function sync_access_mode()
returns trigger
language plpgsql
as $$
begin
  new.registration_mode := case when new.access_mode = 'domain'
    then 'domain'::registration_mode else 'open'::registration_mode end;
  new.require_approval := (new.access_mode = 'approval');
  return new;
end;
$$;

create trigger events_sync_access_mode
  before update of access_mode on events
  for each row
  when (old.access_mode is distinct from new.access_mode)
  execute function sync_access_mode();

-- ---------- LISTA DE CONVIDADOS (planilha) ----------
create table event_allowlist (
  event_id uuid not null references events (id) on delete cascade,
  email text not null,
  added_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  primary key (event_id, email)
);

-- ---------- LGPD ----------
alter table registrations add column consent_accepted_at timestamptz;

-- ============================================================
-- HELPERS DE PERMISSÃO
-- ============================================================

create or replace function is_client_admin(p_client_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select is_admin() or exists (
    select 1 from client_members
    where client_id = p_client_id and user_id = auth.uid() and role = 'admin'
  );
$$;

create or replace function is_client_member(p_client_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select is_admin() or exists (
    select 1 from client_members
    where client_id = p_client_id and user_id = auth.uid()
  );
$$;

-- Participante da "base" do cliente (aprovado em qualquer evento dele)
create or replace function is_client_participant(p_client_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from registrations r
    join events e on e.id = r.event_id
    where e.client_id = p_client_id and r.user_id = auth.uid() and r.status = 'approved'
  );
$$;

-- Quem pode gerenciar o evento por inteiro (equipe/estrutura)
create or replace function can_manage_event(p_event_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select is_staff() or exists (
    select 1 from events e
    where e.id = p_event_id and e.client_id is not null and is_client_admin(e.client_id)
  );
$$;

-- Capacidade específica no evento ('stream','chat','quiz','registrations','reports')
create or replace function has_event_role(p_event_id uuid, p_capability text)
returns boolean
language plpgsql stable security definer
set search_path = public
as $$
begin
  if can_manage_event(p_event_id) then
    return true;
  end if;
  return exists (
    select 1 from event_members em
    where em.event_id = p_event_id and em.user_id = auth.uid()
      and case p_capability
        when 'stream' then em.can_stream
        when 'chat' then em.can_chat
        when 'quiz' then em.can_quiz
        when 'registrations' then em.can_registrations
        when 'reports' then em.can_reports
        else false
      end
  );
end;
$$;

-- Participante aprovado no evento OU da base do cliente (se o evento aceitar)
create or replace function is_approved_participant(p_event_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from registrations
    where event_id = p_event_id and user_id = auth.uid() and status = 'approved'
  ) or exists (
    select 1 from events e
    where e.id = p_event_id and e.accept_client_base and e.client_id is not null
      and is_client_participant(e.client_id)
  );
$$;

-- ============================================================
-- register_for_event v2: modos novos + consentimento LGPD
-- ============================================================
drop function if exists register_for_event(uuid, jsonb);

create or replace function register_for_event(
  p_event_id uuid,
  p_answers jsonb default '{}',
  p_consent boolean default false
)
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
  v_email := lower(v_email);
  v_domain := split_part(v_email, '@', 2);

  select * into v_existing
    from registrations where event_id = p_event_id and user_id = auth.uid();
  if found and v_existing.status in ('rejected', 'banned') then
    raise exception 'Inscrição não permitida';
  end if;

  if v_event.consent_text <> '' and not p_consent then
    raise exception 'Consentimento obrigatório';
  end if;

  if v_event.registration_mode = 'open' then
    v_status := 'approved';
  elsif v_event.registration_mode = 'domain' then
    if v_domain = any (v_event.allowed_domains) then
      v_status := 'approved';
    else
      raise exception 'Domínio de e-mail não autorizado para este evento';
    end if;
  else -- allowlist
    if exists (select 1 from event_allowlist
               where event_id = p_event_id and lower(email) = v_email) then
      v_status := 'approved';
    elsif v_event.allowlist_fallback_approval then
      v_status := 'pending';
    else
      raise exception 'E-mail não está na lista de convidados';
    end if;
  end if;

  if v_status = 'approved' and v_event.require_approval then
    v_status := 'pending';
  end if;

  insert into registrations (event_id, user_id, status, answers, consent_accepted_at)
  values (p_event_id, auth.uid(), v_status, p_answers,
          case when p_consent then now() end)
  on conflict (event_id, user_id) do update
    set answers = excluded.answers,
        consent_accepted_at = coalesce(registrations.consent_accepted_at, excluded.consent_accepted_at)
  returning * into v_row;

  return v_row;
end;
$$;

-- ============================================================
-- RPCs do quiz passam a aceitar a função 'quiz' do evento
-- ============================================================
create or replace function open_question(p_question_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_event uuid;
begin
  select q.event_id into v_event from quiz_questions qq
    join quizzes q on q.id = qq.quiz_id where qq.id = p_question_id;
  if not has_event_role(v_event, 'quiz') then raise exception 'Sem permissão de quiz'; end if;
  update quiz_questions set status = 'open', opened_at = now()
    where id = p_question_id and status = 'pending';
end;
$$;

create or replace function close_question(p_question_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_event uuid;
begin
  select q.event_id into v_event from quiz_questions qq
    join quizzes q on q.id = qq.quiz_id where qq.id = p_question_id;
  if not has_event_role(v_event, 'quiz') then raise exception 'Sem permissão de quiz'; end if;
  update quiz_questions set status = 'closed'
    where id = p_question_id and status = 'open';
end;
$$;

create or replace function reveal_question(p_question_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_event uuid;
begin
  select q.event_id into v_event from quiz_questions qq
    join quizzes q on q.id = qq.quiz_id where qq.id = p_question_id;
  if not has_event_role(v_event, 'quiz') then raise exception 'Sem permissão de quiz'; end if;
  update quiz_questions q
    set status = 'revealed', revealed_correct_index = k.correct_index
    from quiz_keys k
    where q.id = p_question_id and k.question_id = q.id and q.status = 'closed';
end;
$$;

-- ============================================================
-- RLS
-- ============================================================
alter table agencies enable row level security;
alter table clients enable row level security;
alter table client_members enable row level security;
alter table client_invites enable row level security;
alter table event_members enable row level security;
alter table event_allowlist enable row level security;

-- agências: só admin geral
create policy "agencies_admin_all" on agencies for all
  using (is_admin()) with check (is_admin());

-- clientes: pasta pública é visível; restrita para a base; membros sempre
create policy "clients_select" on clients for select
  using (
    folder_visibility = 'public'
    or is_client_member(id)
    or (folder_visibility = 'restricted' and is_client_participant(id))
  );
create policy "clients_admin_insert" on clients for insert
  with check (is_admin());
create policy "clients_update" on clients for update
  using (is_client_admin(id)) with check (is_client_admin(id));
create policy "clients_admin_delete" on clients for delete
  using (is_admin());

-- membros: visíveis à equipe do cliente; gerenciados pelo admin do cliente
create policy "client_members_select" on client_members for select
  using (is_client_member(client_id) or user_id = auth.uid());
create policy "client_members_write" on client_members for all
  using (is_client_admin(client_id)) with check (is_client_admin(client_id));

create policy "client_invites_all" on client_invites for all
  using (is_client_admin(client_id)) with check (is_client_admin(client_id));

-- funções por evento: gerenciadas por quem gerencia o evento
create policy "event_members_select" on event_members for select
  using (user_id = auth.uid() or can_manage_event(event_id));
create policy "event_members_write" on event_members for all
  using (can_manage_event(event_id)) with check (can_manage_event(event_id));

-- allowlist: quem cuida de inscrições
create policy "event_allowlist_select" on event_allowlist for select
  using (has_event_role(event_id, 'registrations'));
create policy "event_allowlist_write" on event_allowlist for all
  using (has_event_role(event_id, 'registrations'))
  with check (has_event_role(event_id, 'registrations'));

-- eventos: admin do cliente cria/edita os seus; rascunho visível à equipe do cliente
drop policy "events_select_published" on events;
create policy "events_select" on events for select
  using (
    status <> 'draft'
    or is_admin()
    or (client_id is not null and is_client_member(client_id))
  );
create policy "events_client_admin_insert" on events for insert
  with check (client_id is not null and is_client_admin(client_id));
create policy "events_operators_update" on events for update
  using (can_manage_event(id) or has_event_role(id, 'stream'))
  with check (can_manage_event(id) or has_event_role(id, 'stream'));
create policy "events_client_admin_delete" on events for delete
  using (client_id is not null and is_client_admin(client_id));

-- chat: função 'chat' modera
drop policy "posts_staff_all" on posts;
create policy "posts_operators_all" on posts for all
  using (has_event_role(event_id, 'chat'))
  with check (has_event_role(event_id, 'chat'));
drop policy "posts_select_participant" on posts;
create policy "posts_select_participant" on posts for select
  using ((deleted_at is null and is_approved_participant(event_id))
         or has_event_role(event_id, 'chat'));

-- inscrições: função 'registrations' gerencia; 'reports' enxerga
drop policy "registrations_select_own_or_staff" on registrations;
create policy "registrations_select" on registrations for select
  using (
    user_id = auth.uid()
    or has_event_role(event_id, 'registrations')
    or has_event_role(event_id, 'reports')
  );
drop policy "registrations_staff_write" on registrations;
create policy "registrations_operators_write" on registrations for all
  using (has_event_role(event_id, 'registrations'))
  with check (has_event_role(event_id, 'registrations'));

-- quiz: função 'quiz' cria e gerencia
drop policy "quizzes_admin_write" on quizzes;
create policy "quizzes_operators_write" on quizzes for all
  using (has_event_role(event_id, 'quiz'))
  with check (has_event_role(event_id, 'quiz'));
drop policy "quizzes_select" on quizzes;
create policy "quizzes_select" on quizzes for select
  using ((status <> 'draft' and is_approved_participant(event_id))
         or has_event_role(event_id, 'quiz'));

drop policy "quiz_questions_admin_write" on quiz_questions;
create policy "quiz_questions_operators_write" on quiz_questions for all
  using (exists (select 1 from quizzes q where q.id = quiz_id
                 and has_event_role(q.event_id, 'quiz')))
  with check (exists (select 1 from quizzes q where q.id = quiz_id
                      and has_event_role(q.event_id, 'quiz')));

drop policy "quiz_keys_admin_only" on quiz_keys;
create policy "quiz_keys_operators_only" on quiz_keys for all
  using (exists (select 1 from quiz_questions qq join quizzes q on q.id = qq.quiz_id
                 where qq.id = question_id and has_event_role(q.event_id, 'quiz')))
  with check (exists (select 1 from quiz_questions qq join quizzes q on q.id = qq.quiz_id
                      where qq.id = question_id and has_event_role(q.event_id, 'quiz')));

-- presença/relatórios
drop policy "attendance_select_own_or_staff" on event_attendance;
create policy "attendance_select" on event_attendance for select
  using (user_id = auth.uid() or has_event_role(event_id, 'reports'));

-- storage: admins de cliente também sobem artes
drop policy "branding_admin_insert" on storage.objects;
create policy "branding_upload" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'branding' and (
      is_staff() or exists (
        select 1 from client_members
        where user_id = auth.uid() and role = 'admin'
      )
    )
  );
