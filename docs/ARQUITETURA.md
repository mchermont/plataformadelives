# Arquitetura

## Visão geral

```
┌─────────────────────────────────────────────────────────┐
│                    Next.js (Vercel)                      │
│                                                          │
│  /admin          → painel: eventos, acesso, quiz, modera │
│  /e/[slug]       → página do evento: player + feed + quiz│
│  /e/[slug]/entrar→ fluxo de cadastro/login do evento     │
│                                                          │
│  Player com adaptadores:                                 │
│   YouTubeAdapter | VimeoAdapter | DacastAdapter | HlsAdapter (fase 2)
└──────────────┬──────────────────────────────────────────┘
               │ supabase-js (RLS aplicado no banco)
┌──────────────▼──────────────────────────────────────────┐
│                       Supabase                           │
│  Postgres  → eventos, inscrições, feed, quiz             │
│  Auth      → e-mail OTP (código) + Google OAuth          │
│  Realtime  → feed/chat, quiz ao vivo, presença (1000 cx) │
└─────────────────────────────────────────────────────────┘
```

## Decisões

1. **Supabase Realtime em vez de WebSocket próprio** — feed, quiz e presença usam
   canais do Supabase. 1000 conexões simultâneas cabem no plano Pro sem operar
   infraestrutura de WebSocket.
2. **Player com adaptadores** — a fonte do vídeo é configuração do evento
   (`stream_provider` + `stream_ref`). Trocar YouTube por Dacast, ou pelo HLS
   próprio na fase 2, não muda a página do evento.
3. **Controle de acesso como configuração, não código** — cada evento define seu
   `access_mode`, domínios permitidos e campos de cadastro. O fluxo de entrada
   lê essa configuração e monta o formulário dinamicamente.
4. **RLS (Row Level Security) em tudo** — o frontend fala direto com o Supabase;
   as políticas no banco garantem que participante só lê o que pode
   (ex.: resposta correta do quiz só aparece depois que a pergunta fecha).
5. **Fase 2 (streaming próprio) via provedor sob demanda** — Cloudflare Stream,
   Mux ou AWS IVS: ingestão RTMP, entrega HLS, cobrança por minuto entregue.
   Sem servidor de mídia próprio para operar.

## Modelo de dados

### Identidade e papéis

- **`profiles`** — espelho de `auth.users`: `id`, `full_name`, `avatar_url`,
  `is_platform_admin` (admin global da plataforma).

### Eventos

- **`events`**
  - `id`, `slug` (URL), `title`, `description`, `cover_url`
  - `starts_at`, `ends_at`, `status`: `draft | scheduled | live | ended`
  - **Vídeo**: `stream_provider`: `youtube | vimeo | dacast | hls`, `stream_ref`
    (ID do vídeo ou URL do embed/manifesto)
  - **Acesso**: `access_mode`: `open | approval | domain`,
    `allowed_domains text[]`, `google_login_enabled bool`, `capacity int`
  - `chat_enabled`, `quiz_enabled`
- **`event_fields`** — campos de cadastro personalizados por evento:
  `event_id`, `label`, `field_type`: `text | select | checkbox`, `required`,
  `options jsonb`, `position`.

### Participação

- **`registrations`** — inscrição de um usuário em um evento:
  `event_id`, `user_id`, `status`: `pending | approved | rejected | banned`,
  `answers jsonb` (respostas aos campos personalizados), `created_at`.
  - `access_mode = open`   → inscrição nasce `approved`
  - `access_mode = approval` → nasce `pending`, admin aprova
  - `access_mode = domain` → `approved` se o domínio do e-mail está em
    `allowed_domains`, senão rejeitada na hora
  - Verificação do e-mail é garantida pelo Auth (OTP por código) **antes** da
    inscrição existir.

### Feed / chat

- **`posts`** — `event_id`, `author_id`, `author_name` (desnormalizado por
  trigger — evita expor a tabela `profiles` a todos), `content`,
  `kind`: `message | announcement`, `pinned bool`, `deleted_at` (soft delete
  para moderação), `created_at`.
- Entrega em tempo real via Supabase Realtime (postgres_changes no canal do evento).
- Presença (usuários online) via Realtime Presence — sem tabela.

### Quiz

- **`quizzes`** — `event_id`, `title`, `status`: `draft | active | closed`.
- **`quiz_questions`** — `quiz_id`, `prompt`, `options jsonb` (lista de alternativas),
  `time_limit_sec`, `position`, `status`: `pending | open | closed | revealed`,
  `opened_at`, `revealed_correct_index` (null até o admin revelar).
- **`quiz_keys`** — gabarito em tabela separada (`question_id`, `correct_index`),
  com RLS exclusiva de admin. A resposta certa **nunca** trafega para
  participantes — nem via select, nem via payload do Realtime. Ao revelar,
  a RPC `reveal_question` copia o gabarito para `revealed_correct_index`.
- **`quiz_answers`** — `question_id`, `user_id`, `selected_index`, `answered_at`.
  - Inserção só pela RPC `answer_question`, que valida status da pergunta,
    janela de tempo e inscrição aprovada no banco.
  - Controle ao vivo por RPCs de admin: `open_question`, `close_question`,
    `reveal_question`.
- Ranking: view `quiz_leaderboard` agregada por evento — acerto vale 1000 +
  bônus de velocidade (até 500), contando perguntas fechadas/reveladas.
  Exposta só via RPC `get_quiz_leaderboard` (checa `has_event_role`
  'quiz'/'reports'); acesso direto à view é revogado de anon/authenticated
  (migração 0022) — view sem RLS própria roda como o dono, então select
  direto vazaria ranking entre eventos/clientes.

## Segurança

- Todas as tabelas com RLS habilitado; escrita de moderação/admin exige
  `is_platform_admin` (fase 1) — papéis por evento entram na fase 3.
- Chaves do Supabase: só a `anon key` vai ao cliente; `service_role` fica em
  rotas de servidor (Next.js Route Handlers) quando necessário.
- Página do evento exige sessão + inscrição `approved` (checada por RLS e no
  layout do evento).

## Limites e escala

- 1000 usuários simultâneos ≈ 1000 conexões Realtime + leituras Postgres.
  Plano Pro do Supabase (US$ 25/mês) suporta 500 conexões; o add-on de
  Realtime ou o plano seguinte cobre 1000. Alternativa: broadcast em vez de
  postgres_changes para o chat (mais barato em conexões de banco).
- Vídeo nunca passa pela nossa infra na fase 1 (embed) nem na fase 2
  (CDN do provedor) — o gargalo de banda não é nosso.
