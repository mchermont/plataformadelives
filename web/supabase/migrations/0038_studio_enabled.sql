-- 0038: Estúdio WebRTC vira opcional por evento — desligado por padrão
-- (ainda em construção). Controla só a navegação/acesso ao painel de
-- produção, não a Fonte do player (esse dropdown perde a opção "studio"
-- separadamente, no código do EventForm).
alter table events add column studio_enabled boolean not null default false;
