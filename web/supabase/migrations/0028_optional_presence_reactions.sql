-- 0028: Contador de "usuários online" e reações em emoji viram opcionais
-- por evento, configurável na aba Interações do EventForm. Default true
-- preserva o comportamento atual pros eventos já existentes.

alter table events add column presence_enabled boolean not null default true;
alter table events add column reactions_enabled boolean not null default true;
