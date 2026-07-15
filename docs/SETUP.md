# Guia de configuração (do zero ao primeiro evento)

## 1. Criar o projeto no Supabase

1. Acesse [supabase.com](https://supabase.com) → **New project** (região `sa-east-1`
   / São Paulo para menor latência no Brasil).
2. Guarde a senha do banco.

## 2. Rodar a migração do banco

No painel do Supabase → **SQL Editor** → cole e execute o conteúdo de
[`web/supabase/migrations/0001_initial_schema.sql`](../web/supabase/migrations/0001_initial_schema.sql).

(Alternativa com CLI: `supabase db push` — requer Docker.)

## 3. Configurar autenticação

No painel → **Authentication**:

1. **Sign In / Up → Email**: habilitado por padrão. O fluxo usa **código OTP**
   (o participante digita 6 dígitos). Em *Email Templates → Magic Link*, troque
   `{{ .ConfirmationURL }}` por `{{ .Token }}` no corpo do e-mail para enviar o
   código em vez do link.
2. **Google** (opcional, recomendado): em *Sign In / Up → Google*, siga o passo
   a passo para criar as credenciais OAuth no Google Cloud Console e cole o
   Client ID/Secret. Em **Authentication → URL Configuration**, adicione:
   - Site URL: `http://localhost:3000` (depois, a URL de produção)
   - Redirect URLs: `http://localhost:3000/auth/callback` (e a de produção)
3. **Rate limits**: em produção, configure um provedor SMTP próprio
   (Resend, Postmark, SES) em *Settings → Auth → SMTP* — o e-mail embutido do
   Supabase é limitado a poucas mensagens/hora.

## 4. Variáveis de ambiente

```bash
cd web
# edite .env.local com os valores de Settings → API do seu projeto:
# NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
```

## 5. Criar o primeiro admin

1. Rode o app (`npm run dev`), acesse um evento qualquer ou use a home e faça
   login com seu e-mail (código OTP) — isso cria seu usuário.
2. No SQL Editor do Supabase:

```sql
update profiles set is_platform_admin = true
where email = 'seu-email@dominio.com';
```

3. Acesse `http://localhost:3000/admin` → crie o primeiro evento.

## 6. Testar um evento completo

1. **Admin** → Novo evento: título, YouTube como fonte (cole a URL de uma live
   ou vídeo), modo de acesso, campos extras. Status **Agendado** → salvar.
2. Abra `/e/<slug>` numa janela anônima → faça o fluxo de inscrição.
3. Se o modo for "com aprovação": Admin → Inscrições → **Aprovar** (a tela do
   participante libera sozinha, em tempo real).
4. Coloque o evento **Ao vivo** → player aparece para todos.
5. Quiz: Admin → Quiz → criar quiz, adicionar perguntas, **Ativar**, e durante
   a live **Abrir ao vivo** → **Fechar** → **Revelar resposta**.

## 7. Deploy (produção)

1. Suba o repositório para o GitHub (recomendado: `git init` em
   `C:\dev\plataforma-lives`).
2. [Vercel](https://vercel.com) → Import → aponte para a pasta `web` →
   configure as env vars (`NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`).
3. Atualize a Site URL/Redirect URLs no Supabase com o domínio de produção.

## Custos estimados (fase 1)

| Item | Custo |
|---|---|
| Vercel Hobby | grátis (Pro US$ 20/mês se precisar) |
| Supabase Pro | US$ 25/mês (necessário para ~1000 conexões Realtime) |
| SMTP (Resend) | grátis até 3k e-mails/mês |
| Vídeo (YouTube/Vimeo/Dacast) | conta própria do provedor |
