-- 0021: revisão de crítica de UX — rejeição silenciosa no chat
-- O autor precisa continuar enxergando a própria mensagem mesmo depois de
-- apagada/rejeitada (a UI mostra "removida pela moderação" em vez de sumir
-- sem explicação). A policy anterior (0015) exigia deleted_at is null mesmo
-- para o próprio autor — corrigido aqui. Fotos já não tinham essa restrição
-- (photos_select da 0016), só precisou de ajuste no frontend.

drop policy "posts_select_participant" on posts;
create policy "posts_select_participant" on posts for select
  using (
    (deleted_at is null and approved and is_approved_participant(event_id))
    or author_id = auth.uid()
    or has_event_role(event_id, 'chat')
  );
