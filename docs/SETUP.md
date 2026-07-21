# Guia de configuração (do zero ao primeiro evento)

## 1. Criar o projeto no Supabase

1. Acesse [supabase.com](https://supabase.com) → **New project** (região `sa-east-1`
   / São Paulo para menor latência no Brasil).
2. Guarde a senha do banco.

## 2. Rodar as migrações do banco (sempre por terminal)

Nunca cole SQL no painel do Supabase — todo o histórico de mudanças de
schema vive em `web/supabase/migrations/`, numerado sequencialmente
(hoje até `00XX`, confira o mais recente na pasta), e é aplicado via script:

```bash
cd web
echo "postgresql://postgres:SENHA@db.SEU-PROJETO.supabase.co:5432/postgres" > .db-url
# .db-url é gitignored — nunca comitar a connection string

# banco novo: aplica todas as migrações em ordem
for f in supabase/migrations/*.sql; do
  node scripts/migrate.mjs "$f" || break
done
```

(Cada migração roda dentro de uma transação — se uma falhar, o script para
com rollback aplicado e não segue para a próxima.)

## 3. Configurar autenticação

No painel → **Authentication**:

1. **Sign In / Up → Email**: habilitado por padrão. O fluxo usa **código OTP**
   (6 dígitos) por padrão, com link como alternativa — ver
   [`SMTP.md`](SMTP.md) pra configurar o remetente próprio e trocar o
   template do e-mail padrão do Supabase pelo código.
2. **Google** (opcional): em *Sign In / Up → Google*, siga o passo a passo
   pra criar as credenciais OAuth no Google Cloud Console e cole o Client
   ID/Secret. Em **Authentication → URL Configuration**, adicione:
   - Site URL: `http://localhost:3000` (depois, a URL de produção)
   - Redirect URLs: `http://localhost:3000/auth/callback` (e a de produção)
3. **SMTP e rate limits**: sem SMTP próprio, o e-mail embutido do Supabase é
   limitado a poucas mensagens/hora — configure antes de testar com volume
   real (ver [`SMTP.md`](SMTP.md)).

## 4. Variáveis de ambiente

```bash
cd web
# edite .env.local com os valores de Settings → API do seu projeto:
# NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
```

`SUPABASE_SERVICE_ROLE_KEY` (mesma tela, chave **`service_role`/secret** —
nunca a `anon`) é opcional pro app rodar, mas necessária pra excluir conta
de usuário de verdade em `/admin/equipe` (rota `/api/admin/users/[id]`,
ver `ARQUITETURA.md`). Ignora RLS por completo — trate como senha, nunca
comite, nunca exponha `NEXT_PUBLIC_`.

## 5. Criar o primeiro admin

1. Rode o app (`npm run dev`), acesse `/login` e entre com seu e-mail
   (código OTP) — isso cria seu usuário em `profiles`.
2. Via terminal (mesma connection string do `.db-url`, `psql` ou um script
   `pg` avulso — é um update pontual de dado, não uma migração):

```sql
update profiles set is_platform_admin = true
where email = 'seu-email@dominio.com';
```

3. Acesse `http://localhost:3000/admin` → cria clientes/agências e eventos.

## 6. Testar um evento completo

1. **Admin** → Clientes → cria um cliente (ou pula e cria o evento sem
   vínculo, via `/admin/eventos/novo`) → Novo evento: título, YouTube como
   fonte (cole a URL de uma live ou vídeo), modo de inscrição, campos
   extras. Aba **Interações** → habilita os tipos de atividade que quer usar
   (nuvem de palavras, enquete, quiz etc). Status **Agendado** → salvar.
2. Abra a página pública do evento (link em `/admin/eventos/[id]`) numa
   janela anônima → faça o fluxo de cadastro.
3. Se o modo exigir aprovação: Admin → Inscrições → **Aprovar** (a tela do
   participante libera sozinha, em tempo real).
4. Coloque o evento **Ao vivo** (botão "● Entrar no ar" na Sala de
   produção) → player aparece pra todo mundo.
5. Quiz/atividades: Sala de produção → **Atividades interativas** → escolhe
   o tipo, cria, **Abrir** → participantes respondem → **Fechar** →
   **Exibir resultado**.

## 7. Deploy (produção)

1. Suba o repositório pro GitHub.
2. [Railway](https://railway.app) → New Project → Deploy from GitHub repo →
   configure o **root directory como `web`** e as env vars
   (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `NEXT_PUBLIC_SITE_URL`, `SUPABASE_SERVICE_ROLE_KEY`). Cada push na
   `main` builda e publica sozinho.
3. Atualize a Site URL/Redirect URLs no Supabase com o domínio de produção.

## Custos estimados

| Item | Custo |
|---|---|
| Railway | conforme uso (plano Hobby cobre a maioria dos casos) |
| Supabase Pro | US$ 25/mês (necessário para ~1000 conexões Realtime) |
| SMTP (Hostinger) | incluído no plano de hospedagem/e-mail já contratado |
| Vídeo (YouTube/Vimeo/Dacast) | conta própria do provedor |
