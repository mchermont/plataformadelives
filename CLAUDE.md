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
  a última aplicada é a 0021.
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
  controles/logo/título nativos (sem zoom/crop — cortava imagem, removido),
  autoplay mudo. `stream_ref` não vai no HTML inicial nem no Realtime bruto
  da tabela `events` (vazava a linha inteira) — a sala usa `get_room_event`
  (RPC, polling autenticado) que só inclui a fonte quando `status = 'live'`.
  `DisableInspect.tsx` bloqueia clique-direito e atalhos comuns (F12,
  Ctrl+Shift+I/J/C, Ctrl+U) na sala e no telão — **best-effort, não é
  segurança real**: o navegador reserva F12/menu de DevTools independente
  de JS, e a requisição ao YouTube/Vimeo sempre aparece na aba Network.
  Ocultar de verdade só com streaming próprio (Fase J).
- **UI sem scroll** nas áreas de interação: ou pagina, ou cabe na tela
  (regra do Marcelo). Chat/listas rolam só internamente.
- Textos da UI em pt-BR; CSVs e datas em formato brasileiro.
- **Ações destrutivas sempre com `confirm()`** (banir, apagar mensagem/foto/
  pergunta/resposta) — padrão consolidado após revisão `/impeccable critique`
  em 19/07/2026; qualquer exclusão nova segue o mesmo padrão.
- Erros técnicos do Supabase/Postgres passam por `src/lib/friendlyError.ts`
  antes de chegar à UI (não expor `err.message` cru a usuário/operador).
- **Design tokens onix** (`globals.css`): `bg-bg`/`bg-surface`/`text-ink`/
  `text-muted`/`bg-accent`/`border-border-c`, além da paleta Tailwind
  (`neutral-800`/`sky-600`/`purple-500` etc.) sobrescrita centralmente em
  OKLCH onix + grafite quente — qualquer uso desses tons já herda o sistema
  novo automaticamente, não precisa trocar por token custom.
- **Ícones**: `lucide-react` no chrome de interface inteiro (botões, badges,
  categorias, paginação, check/x/fechar). Emoji só em celebração de verdade:
  `Reactions.tsx`, revelação de ganhador de sorteio (telão/overlay/
  `RaffleManager`), medalhas do ranking. O "●" do badge "AO VIVO" é
  convenção de status, não ícone — mantido como glyph.
- **Dados de evento/cliente no admin**: usar `getEventChain`/
  `getClientChain` de `src/lib/admin/chains.ts` (memoizados por request)
  em vez de buscar `events`/`clients` direto — layout e página reaproveitam
  a mesma busca.

## Estado (19/07/2026)

Fases concluídas: MVP, multi-tenant A–D, E (motor de atividades completo),
F (Q&A com upvote), G (chat pré-moderado, galeria de fotos com moderação
obrigatória, materiais p/ download — buckets `gallery` e `materials`),
H (sorteios auditáveis no Diretor + telão), I (player YouTube white-label —
`YouTubePlayer.tsx`, IFrame API, capa própria, sem migração). Revisão de
UX/UI completa (`/impeccable critique`) nas 3 telas centrais — ver ROADMAP.
Reestruturação de navegação (`/impeccable shape`, ver `web/PRODUCT.md`):
Fases A (shell com sidebar + breadcrumb + tokens onix) e B (paleta onix em
toda a app + emoji→lucide-react no chrome) concluídas; Fase C (vitrine
clara) pendente. Próxima fase de produto: J (streaming próprio). Pendências
avulsas:
Google OAuth (falta credencial), upload de planilha p/ allowlist, revisar
view `quiz_leaderboard` (roda como owner), evento-piloto em produção.
