-- ============================================================
-- Migração 0008: fecha as lacunas de permissão dos operadores
-- por evento (relatórios/presença/respostas) e libera upload de
-- artes no bucket branding para equipes de cliente/agência.
-- (posts, registrations e quiz já usam has_event_role desde a 0004)
-- Drops com IF EXISTS: o banco tem variações de nome de política
-- da época em que as migrações eram aplicadas pelo painel.
-- ============================================================

-- Presença: função 'reports' enxerga (para o relatório do evento)
drop policy if exists "attendance_select_own_or_staff" on event_attendance;
drop policy if exists "attendance_select_own_or_admin" on event_attendance;
drop policy if exists "attendance_select" on event_attendance;
create policy "attendance_select" on event_attendance for select
  using (
    user_id = auth.uid()
    or is_staff()
    or has_event_role(event_id, 'reports')
  );

-- Respostas do quiz: operadores de quiz e de relatórios enxergam
drop policy if exists "quiz_answers_select_own_or_staff" on quiz_answers;
drop policy if exists "quiz_answers_select_own_or_admin" on quiz_answers;
drop policy if exists "quiz_answers_select" on quiz_answers;
create policy "quiz_answers_select" on quiz_answers for select
  using (
    user_id = auth.uid()
    or is_staff()
    or exists (
      select 1 from quiz_questions qq
      join quizzes q on q.id = qq.quiz_id
      where qq.id = question_id
        and (has_event_role(q.event_id, 'quiz') or has_event_role(q.event_id, 'reports'))
    )
  );

-- ---------- STORAGE: artes por equipes de cliente/agência ----------
-- Membro de qualquer organização (ou staff da plataforma)
create or replace function is_org_staff()
returns boolean
language sql stable security definer set search_path = public
as $$
  select is_staff()
    or exists (select 1 from client_members where user_id = auth.uid())
    or exists (select 1 from agency_members where user_id = auth.uid());
$$;

drop policy if exists "branding_admin_insert" on storage.objects;
drop policy if exists "branding_org_insert" on storage.objects;
create policy "branding_org_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'branding' and is_org_staff());

drop policy if exists "branding_admin_update" on storage.objects;
drop policy if exists "branding_org_update" on storage.objects;
create policy "branding_org_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'branding' and is_org_staff());

-- delete continua exclusivo do admin da plataforma (branding_admin_delete)
