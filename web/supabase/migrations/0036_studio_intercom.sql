-- Intercom: Diretor fala em privado (PTT) com um participante ou com todos.
-- "__all__" é o valor sentinela pra "Todos"; qualquer outro valor é a
-- identity de um participante específico. NULL = intercom desligado.
alter table studio_rooms
  add column intercom_target_id varchar(255) default null;
