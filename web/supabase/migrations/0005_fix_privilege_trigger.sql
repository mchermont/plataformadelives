-- ============================================================
-- Migração 0005: corrige o gatilho de proteção de privilégios
-- Ele bloqueava também o SQL Editor/postgres (sem auth.uid()),
-- impedindo promoções administrativas legítimas.
-- ============================================================

create or replace function protect_profile_privileges()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is not null and not is_admin() then
    new.is_platform_admin := old.is_platform_admin;
    new.is_moderator := old.is_moderator;
  end if;
  return new;
end;
$$;
