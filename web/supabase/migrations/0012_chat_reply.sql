-- 0012: reply no chat — mensagem pode citar outra
alter table posts add column reply_to_id uuid references posts(id) on delete set null;
