# Plataforma de Lives — contexto para o Claude

Plataforma white-label de lives com gamificação (estilo Mentimeter + quiz +
Q&A), multi-tenant (Agência → Cliente → Evento), operada pela Propano Filmes.

## Regras de ouro

- **O código vive em `C:\dev\plataforma-lives`.** A pasta no Google Drive
  (`G:\Meu Drive\JOBS\Plataforma de lives`) é só espelho de backup — nunca
  trabalhe lá. Após commits relevantes, rode `.\sync-to-drive.ps1` (raiz).
- **Deploy = commit + push na main** (Railway builda sozinho).
  Produção: https://lives.propanofilmes.com.br
- **Migrações SEMPRE por terminal**, nunca pelo painel do Supabase:
  `cd web && node scripts/migrate.mjs supabase/migrations/00XX_nome.sql`
  (connection string em `web/.db-url`, gitignored). Numerar sequencialmente;
  a última aplicada é a 0020.
- **Next.js 16**: APIs mudaram (params/cookies assíncronos, proxy.ts no lugar
  de middleware, Turbopack). Ler `web/node_modules/next/dist/docs/` antes de
  usar API que você "conhece". Verificação: `npx tsc --noEmit` + `npx next build`.
- Roadmap e estado das fases: `docs/ROADMAP.md` (fonte da verdade — marcar
  os checks ao concluir).

## Stack e estrutura

- Next.js 16 (App Router) + Tailwind 4 + Supabase (Postgres/Auth/Realtime),
  tudo em `web/`. Deploy Railway (root dir `/web`).
- Supabase ref `hvovyedfpyzlctubnuhp` (ca-central-1). Chaves em
  `web/.env.local`. SMTP Hostinger (código OTP por e-mail, 150/h).
- Tipos do domínio espelhando o schema: `web/src/lib/types.ts`.
- Rotas públicas: `/[clientSlug]` (pasta do cliente), `/[clientSlug]/[eventSlug]`
  (sala; `/e/[slug]` é legado p/ eventos sem cliente), `/telao/[eventId]`
  (telão OBS, público — UUID é o token, só agregados anônimos).
- Admin: `/admin` (clientes) → `/admin/eventos/[id]` (form + equipe) →
  `/admin/eventos/[id]/live` (painel Diretor: atividades, quiz, chat, Q&A).

## Convenções do produto

- Permissões por evento = 5 caixas em `event_members`
  (stream/chat/quiz/registrations/reports) via `has_event_role()`;
  `can_quiz` = "Quiz e interações"; moderação de chat, Q&A e galeria de fotos
  usa `can_chat`; materiais p/ download usam `can_stream` (ou gestor).
- **Anonimato**: telas públicas anônimas; export CSV identificado (padrão
  pt-BR: separador `;` + BOM UTF-8).
- **Atividades interativas** (tabelas `activities`/`activity_responses`):
  modelo "slide ativo" — 1 aberta por vez; abrir→fechar→exibir→limpar via
  RPC `activity_control`. Tipos: word_cloud, poll, quiz (rodadas de
  perguntas; ranking geral é botão dentro do quiz), scale, open_text
  (spotlight no telão), ordering, matrix. Inserts só via RPCs
  (`submit_activity_response`, `answer_question`, `submit_question`).
- Blocklist de texto livre: tabela `banned_words` (match por palavra inteira).
- **Sorteios** (tabela `raffles`, permissão `can_quiz`): só via RPC
  `run_raffle` — semente + md5 determinístico, sem policy de UPDATE (log
  imutável, CSV de auditoria); exibição no telão via `raffle_display`.
- **Player white-label** (`YouTubePlayer.tsx`/`VimeoPlayer.tsx`): sem
  controles/logo/título nativos, autoplay mudo, zoom+crop, clique-direito
  bloqueado. `stream_ref` não vai no HTML inicial nem no Realtime bruto da
  tabela `events` (vazava a linha inteira) — a sala usa `get_room_event`
  (RPC, polling autenticado) que só inclui a fonte quando `status = 'live'`.
  Limite: a requisição ao YouTube/Vimeo sempre aparece na aba Network do
  DevTools — impossível de evitar em embed client-side (só resolve na
  Fase J, streaming próprio).
- **UI sem scroll** nas áreas de interação: ou pagina, ou cabe na tela
  (regra do Marcelo). Chat/listas rolam só internamente.
- Textos da UI em pt-BR; CSVs e datas em formato brasileiro.

## Estado (19/07/2026)

Fases concluídas: MVP, multi-tenant A–D, E (motor de atividades completo),
F (Q&A com upvote), G (chat pré-moderado, galeria de fotos com moderação
obrigatória, materiais p/ download — buckets `gallery` e `materials`),
H (sorteios auditáveis no Diretor + telão), I (player YouTube white-label —
`YouTubePlayer.tsx`, IFrame API, capa própria, sem migração). Próxima:
J (streaming próprio). Pendências avulsas:
Google OAuth (falta credencial), upload de planilha p/ allowlist, revisar
view `quiz_leaderboard` (roda como owner), evento-piloto em produção.
