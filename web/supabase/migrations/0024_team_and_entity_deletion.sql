-- ============================================================
-- Migração 0024: exclusão de pessoas da equipe (inclusive admins),
-- exclusão de agência/cliente/evento e proteção de "último admin"
-- ============================================================

-- ---------- Deletar conta de usuário não pode travar em FK ----------
-- Chat e evento guardam o nome no momento (author_name/já denormalizado),
-- então perder o vínculo com o autor não perde legibilidade histórica.
alter table posts alter column author_id drop not null;
alter table posts drop constraint posts_author_id_fkey;
alter table posts add constraint posts_author_id_fkey
  foreign key (author_id) references profiles (id) on delete set null;

alter table events alter column created_by drop not null;
alter table events drop constraint events_created_by_fkey;
alter table events add constraint events_created_by_fkey
  foreign key (created_by) references profiles (id) on delete set null;

alter table questions alter column author_id drop not null;
alter table questions drop constraint questions_author_id_fkey;
alter table questions add constraint questions_author_id_fkey
  foreign key (author_id) references profiles (id) on delete set null;

alter table event_photos alter column author_id drop not null;
alter table event_photos drop constraint event_photos_author_id_fkey;
alter table event_photos add constraint event_photos_author_id_fkey
  foreign key (author_id) references profiles (id) on delete set null;

-- Convites/allowlist só guardam "quem convidou" como trilha de auditoria —
-- perder essa referência não invalida o convite/e-mail em si.
alter table client_invites drop constraint client_invites_invited_by_fkey;
alter table client_invites add constraint client_invites_invited_by_fkey
  foreign key (invited_by) references profiles (id) on delete set null;

alter table agency_invites drop constraint agency_invites_invited_by_fkey;
alter table agency_invites add constraint agency_invites_invited_by_fkey
  foreign key (invited_by) references profiles (id) on delete set null;

alter table event_allowlist drop constraint event_allowlist_added_by_fkey;
alter table event_allowlist add constraint event_allowlist_added_by_fkey
  foreign key (added_by) references profiles (id) on delete set null;

-- ---------- Proteção: não deixar cliente/agência sem nenhum admin ----------
-- Cobre remoção (delete) e rebaixar o último admin a colaborador (update).
-- Mensagem em pt-BR passa direto pelo friendlyError (heurística de acento).
create or replace function enforce_last_client_admin()
returns trigger
language plpgsql
as $$
begin
  if old.role = 'admin' and (tg_op = 'DELETE' or new.role <> 'admin') then
    if not exists (
      select 1 from client_members
      where client_id = old.client_id and role = 'admin' and user_id <> old.user_id
    ) then
      raise exception 'Não é possível remover o último administrador do cliente. Promova outra pessoa a administradora antes.';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger client_members_protect_last_admin
  before delete or update of role on client_members
  for each row execute function enforce_last_client_admin();

create or replace function enforce_last_agency_admin()
returns trigger
language plpgsql
as $$
begin
  if old.role = 'admin' and (tg_op = 'DELETE' or new.role <> 'admin') then
    if not exists (
      select 1 from agency_members
      where agency_id = old.agency_id and role = 'admin' and user_id <> old.user_id
    ) then
      raise exception 'Não é possível remover o último administrador da agência. Promova outra pessoa a administradora antes.';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger agency_members_protect_last_admin
  before delete or update of role on agency_members
  for each row execute function enforce_last_agency_admin();
