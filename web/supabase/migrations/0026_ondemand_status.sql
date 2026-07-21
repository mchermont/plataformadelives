-- ============================================================
-- Migração 0026: status "ondemand" — depois de encerrar, o Diretor pode
-- deixar a gravação disponível pro participante assistir depois. Não é
-- "ao vivo" (interações continuam travadas, mesma regra da migração 0025,
-- que trava por status <> 'live'), só reabre o player com o mesmo
-- stream_ref (o provedor troca pra VOD sozinho no mesmo link/ID).
-- ============================================================

alter type event_status add value 'ondemand';
