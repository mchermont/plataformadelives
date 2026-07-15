-- ============================================================
-- Migração 0002: white-label por evento + papel de moderador
-- ============================================================

-- ---------- WHITE-LABEL ----------
alter table events
  add column brand_logo_url text,
  add column brand_color text not null default '#0284c7'
    check (brand_color ~ '^#[0-9a-fA-F]{6}$');

-- Bucket público para logos e capas dos eventos
insert into storage.buckets (id, name, public)
values ('branding', 'branding', true)
on conflict (id) do nothing;

create policy "branding_public_read" on storage.objects
  for select using (bucket_id = 'branding');
create policy "branding_admin_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'branding' and is_admin());
create policy "branding_admin_update" on storage.objects
  for update to authenticated using (bucket_id = 'branding' and is_admin());
create policy "branding_admin_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'branding' and is_admin());

-- ---------- MODERADORES ----------
alter table profiles add column is_moderator boolean not null default false;

-- Staff = admin da plataforma ou moderador (equipe que opera a live)
create or replace function is_staff()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(
    (select is_platform_admin or is_moderator from profiles where id = auth.uid()),
    false
  );
$$;

-- Impede que não-admins alterem os próprios privilégios
create or replace function protect_profile_privileges()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if not is_admin() then
    new.is_platform_admin := old.is_platform_admin;
    new.is_moderator := old.is_moderator;
  end if;
  return new;
end;
$$;

create trigger profiles_protect_privileges
  before update on profiles
  for each row execute function protect_profile_privileges();

-- Política de update: o próprio usuário (privilégios protegidos pelo trigger) ou admin
drop policy "profiles_update_own" on profiles;
create policy "profiles_update_own_or_admin" on profiles for update
  using (id = auth.uid() or is_admin())
  with check (id = auth.uid() or is_admin());

-- Admin promove/despromove moderadores
create or replace function set_moderator(p_user_id uuid, p_is_moderator boolean)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not is_admin() then raise exception 'Apenas admin'; end if;
  update profiles set is_moderator = p_is_moderator where id = p_user_id;
end;
$$;

-- Staff enxerga perfis (para listas de inscrição e equipe)
drop policy "profiles_select_own_or_admin" on profiles;
create policy "profiles_select_own_or_staff" on profiles for select
  using (id = auth.uid() or is_staff());

-- ---------- PODERES DO STAFF ----------
-- Moderação de chat
drop policy "posts_select_participant" on posts;
create policy "posts_select_participant" on posts for select
  using ((deleted_at is null and is_approved_participant(event_id)) or is_staff());
drop policy "posts_admin_all" on posts;
create policy "posts_staff_all" on posts for all
  using (is_staff()) with check (is_staff());

-- Aprovação/banimento de inscrições
drop policy "registrations_select_own_or_admin" on registrations;
create policy "registrations_select_own_or_staff" on registrations for select
  using (user_id = auth.uid() or is_staff());
drop policy "registrations_admin_write" on registrations;
create policy "registrations_staff_write" on registrations for all
  using (is_staff()) with check (is_staff());

-- Operação do quiz ao vivo (criar/editar quiz continua sendo admin)
drop policy "quizzes_select" on quizzes;
create policy "quizzes_select" on quizzes for select
  using ((status <> 'draft' and is_approved_participant(event_id)) or is_staff());
drop policy "quiz_questions_select" on quiz_questions;
create policy "quiz_questions_select" on quiz_questions for select
  using (
    is_staff() or (
      status <> 'pending'
      and exists (
        select 1 from quizzes q
        where q.id = quiz_id and q.status <> 'draft' and is_approved_participant(q.event_id)
      )
    )
  );

create or replace function open_question(p_question_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not is_staff() then raise exception 'Apenas equipe'; end if;
  update quiz_questions
    set status = 'open', opened_at = now()
    where id = p_question_id and status = 'pending';
end;
$$;

create or replace function close_question(p_question_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not is_staff() then raise exception 'Apenas equipe'; end if;
  update quiz_questions set status = 'closed'
    where id = p_question_id and status = 'open';
end;
$$;

create or replace function reveal_question(p_question_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not is_staff() then raise exception 'Apenas equipe'; end if;
  update quiz_questions q
    set status = 'revealed',
        revealed_correct_index = k.correct_index
    from quiz_keys k
    where q.id = p_question_id and k.question_id = q.id and q.status = 'closed';
end;
$$;

-- Contagem de respostas para o staff (a tabela quiz_answers segue restrita)
drop policy "quiz_answers_select_own_or_admin" on quiz_answers;
create policy "quiz_answers_select_own_or_staff" on quiz_answers for select
  using (user_id = auth.uid() or is_staff());
