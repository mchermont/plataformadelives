-- ============================================================
-- Migração 0031: protege o evento "modelo" do ambiente demo (0029) de
-- edição/exclusão por quem só é admin do Cliente Demo — hoje isso
-- inclui o login público demo@golive.net.br. A ideia é deixar
-- visitantes de teste alterarem à vontade as artes do evento "ao vivo"
-- (é assim que eles entendem dimensões/como funciona), mas sem
-- conseguir estragar o modelo que o Marcelo mantém como padrão.
--
-- Só quem é admin de plataforma de verdade (`is_admin()`) pode
-- editar/apagar o evento "modelo" — client_members admin não basta mais
-- pra esse evento específico.
-- ============================================================

create or replace function is_protected_demo_template(p_event_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from events where id = p_event_id and slug = 'evento-modelo'
  );
$$;

drop policy "events_operators_update" on events;
create policy "events_operators_update" on events for update
  using (
    (can_manage_event(id) or has_event_role(id, 'stream'))
    and (is_admin() or not is_protected_demo_template(id))
  )
  with check (
    (can_manage_event(id) or has_event_role(id, 'stream'))
    and (is_admin() or not is_protected_demo_template(id))
  );

drop policy "events_client_admin_delete" on events;
create policy "events_client_admin_delete" on events for delete
  using (
    client_id is not null and is_client_admin(client_id)
    and (is_admin() or not is_protected_demo_template(id))
  );
