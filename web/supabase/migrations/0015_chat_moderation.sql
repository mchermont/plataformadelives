-- 0015: Fase G.1 — Chat pré-moderado
-- Opção por evento: com moderação ativa, mensagem de participante só aparece
-- para todos após aprovação de um operador de chat (fila no painel Diretor).

alter table events add column chat_moderation boolean not null default false;
alter table posts add column approved boolean not null default true;

-- Define approved no insert (cliente não controla): participante em evento
-- moderado entra pendente; operadores de chat publicam direto.
create or replace function set_post_moderation()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if (select chat_moderation from events where id = new.event_id)
     and not has_event_role(new.event_id, 'chat') then
    new.approved := false;
  else
    new.approved := true;
  end if;
  return new;
end;
$$;

create trigger posts_set_moderation
  before insert on posts
  for each row execute function set_post_moderation();

-- Participante vê aprovadas + as próprias pendentes (acompanha a moderação);
-- operador de chat vê tudo (fila + apagadas).
drop policy "posts_select_participant" on posts;
create policy "posts_select_participant" on posts for select
  using (
    (deleted_at is null and approved and is_approved_participant(event_id))
    or (author_id = auth.uid() and deleted_at is null)
    or has_event_role(event_id, 'chat')
  );
