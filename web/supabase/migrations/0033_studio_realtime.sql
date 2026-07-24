-- ============================================================
-- Migração 0033: liga o Realtime das tabelas do Estúdio (0032)
--
-- Sintoma: mudar cena/layout/banner no Diretor não refletia no convidado
-- nem na saída OBS. Causa: StudioControlRoom/guest/output assinam
-- `postgres_changes` em `studio_rooms`/`studio_assets`, mas as tabelas
-- nunca entraram na publicação `supabase_realtime` — o evento não
-- disparava.
--
-- Além de publicar, é preciso REPLICA IDENTITY FULL: o Diretor grava via
-- upsert (onConflict event_id), que na prática é UPDATE depois da 1ª
-- criação; as assinaturas filtram por `event_id` (não a PK). Com a
-- replica identity padrão (só a PK `id`), o `event_id` não vai no WAL do
-- UPDATE e o filtro do Realtime descarta o evento. FULL coloca a linha
-- inteira no WAL, então o filtro por event_id casa em UPDATE/DELETE.
-- ============================================================

alter table public.studio_rooms replica identity full;
alter table public.studio_assets replica identity full;

alter publication supabase_realtime add table public.studio_rooms;
alter publication supabase_realtime add table public.studio_assets;
