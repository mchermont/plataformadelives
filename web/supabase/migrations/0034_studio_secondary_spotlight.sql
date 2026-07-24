-- Segundo slot de destaque pro arranjo "Split 2:1": o Diretor escolhe
-- explicitamente quem ocupa o 1fr menor, em vez de cair automaticamente
-- no próximo participante do palco.
alter table studio_rooms
  add column secondary_participant_id varchar(255) default null;
