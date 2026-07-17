-- ============================================================
-- Migração 0006: camada de Agência/Produtora
-- Espelha o modelo de clientes: membros, convites e herança de acesso.
-- Agência é organização/acesso — NÃO aparece na URL pública.
-- ============================================================

-- ---------- MEMBROS E CONVITES DA AGÊNCIA ----------
create table agency_members (
  agency_id uuid not null references agencies (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  role client_role not null default 'collaborator',
  created_at timestamptz not null default now(),
  primary key (agency_id, user_id)
);

create table agency_invites (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references agencies (id) on delete cascade,
  email text not null,
  role client_role not null default 'collaborator',
  invited_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  unique (agency_id, email)
);

-- ---------- HELPERS ----------
create or replace function is_agency_admin(p_agency_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select is_admin() or exists (
    select 1 from agency_members
    where agency_id = p_agency_id and user_id = auth.uid() and role = 'admin'
  );
$$;

create or replace function is_agency_member(p_agency_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select is_admin() or exists (
    select 1 from agency_members
    where agency_id = p_agency_id and user_id = auth.uid()
  );
$$;

-- Membro/admin da agência herda acesso a TODOS os clientes daquela agência
create or replace function is_client_admin(p_client_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select is_admin()
    or exists (
      select 1 from client_members
      where client_id = p_client_id and user_id = auth.uid() and role = 'admin'
    )
    or exists (
      select 1 from clients c
      where c.id = p_client_id and c.agency_id is not null and is_agency_admin(c.agency_id)
    );
$$;

create or replace function is_client_member(p_client_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select is_admin()
    or exists (
      select 1 from client_members
      where client_id = p_client_id and user_id = auth.uid()
    )
    or exists (
      select 1 from clients c
      where c.id = p_client_id and c.agency_id is not null and is_agency_member(c.agency_id)
    );
$$;

-- Ver perfis de quem compartilha organização (para as telas de equipe)
create or replace function shares_org(p_target uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select
    exists (
      select 1 from client_members a
      join client_members b on a.client_id = b.client_id
      where a.user_id = auth.uid() and b.user_id = p_target
    )
    or exists (
      select 1 from agency_members a
      join agency_members b on a.agency_id = b.agency_id
      where a.user_id = auth.uid() and b.user_id = p_target
    )
    or exists (
      select 1 from client_members cm
      where cm.user_id = p_target and is_client_admin(cm.client_id)
    )
    or exists (
      select 1 from agency_members am
      where am.user_id = p_target and is_agency_admin(am.agency_id)
    );
$$;

-- ---------- CONVITES: ativação no signup (agora inclui agências) ----------
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

  insert into agency_members (agency_id, user_id, role)
  select ai.agency_id, new.id, ai.role
  from agency_invites ai
  where lower(ai.email) = lower(new.email) and ai.accepted_at is null
  on conflict (agency_id, user_id) do nothing;
  update agency_invites set accepted_at = now()
  where lower(email) = lower(new.email) and accepted_at is null;

  return new;
end;
$$;

-- ---------- CONVITE VIA RPC (funciona sem leitura ampla de profiles) ----------
create or replace function invite_to_client(p_client_id uuid, p_email text, p_role client_role)
returns text
language plpgsql security definer set search_path = public
as $$
declare v_uid uuid;
begin
  if not is_client_admin(p_client_id) then raise exception 'Sem permissão'; end if;
  select id into v_uid from profiles where lower(email) = lower(p_email);
  if v_uid is not null then
    insert into client_members (client_id, user_id, role)
    values (p_client_id, v_uid, p_role)
    on conflict (client_id, user_id) do update set role = excluded.role;
    return 'added';
  else
    insert into client_invites (client_id, email, role, invited_by)
    values (p_client_id, lower(p_email), p_role, auth.uid())
    on conflict (client_id, email) do update set role = excluded.role;
    return 'invited';
  end if;
end;
$$;

create or replace function invite_to_agency(p_agency_id uuid, p_email text, p_role client_role)
returns text
language plpgsql security definer set search_path = public
as $$
declare v_uid uuid;
begin
  if not is_agency_admin(p_agency_id) then raise exception 'Sem permissão'; end if;
  select id into v_uid from profiles where lower(email) = lower(p_email);
  if v_uid is not null then
    insert into agency_members (agency_id, user_id, role)
    values (p_agency_id, v_uid, p_role)
    on conflict (agency_id, user_id) do update set role = excluded.role;
    return 'added';
  else
    insert into agency_invites (agency_id, email, role, invited_by)
    values (p_agency_id, lower(p_email), p_role, auth.uid())
    on conflict (agency_id, email) do update set role = excluded.role;
    return 'invited';
  end if;
end;
$$;

-- ============================================================
-- RLS
-- ============================================================
alter table agency_members enable row level security;
alter table agency_invites enable row level security;

-- agencies: membro vê a sua; admin geral cria/apaga; admin da agência edita
drop policy "agencies_admin_all" on agencies;
create policy "agencies_select" on agencies for select using (is_agency_member(id));
create policy "agencies_insert" on agencies for insert with check (is_admin());
create policy "agencies_update" on agencies for update
  using (is_agency_admin(id)) with check (is_agency_admin(id));
create policy "agencies_delete" on agencies for delete using (is_admin());

create policy "agency_members_select" on agency_members for select
  using (user_id = auth.uid() or is_agency_member(agency_id));
create policy "agency_members_write" on agency_members for all
  using (is_agency_admin(agency_id)) with check (is_agency_admin(agency_id));

create policy "agency_invites_all" on agency_invites for all
  using (is_agency_admin(agency_id)) with check (is_agency_admin(agency_id));

-- clientes: admin da agência também cria/apaga clientes da sua agência
drop policy "clients_admin_insert" on clients;
create policy "clients_insert" on clients for insert
  with check (is_admin() or (agency_id is not null and is_agency_admin(agency_id)));
drop policy "clients_admin_delete" on clients;
create policy "clients_delete" on clients for delete
  using (is_admin() or (agency_id is not null and is_agency_admin(agency_id)));

-- profiles: permite ver perfis de quem compartilha organização
create policy "profiles_select_org" on profiles for select using (shares_org(id));
