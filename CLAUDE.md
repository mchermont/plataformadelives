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
  a última aplicada é a 0029.
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
  `events.enabled_activity_types` (migração 0023) controla quais tipos o
  evento pode usar — configurado na aba Interações do EventForm, filtra o
  que aparece pra criar no Diretor; RLS de `activities` também exige o tipo
  habilitado (defesa em profundidade, não só filtro de UI).
- **Q&A**: aprovação é sempre obrigatória (não é mais opcional) — toda
  pergunta nasce `pending` e só fica pública quando o colaborador aprova
  (`can_chat`); upvote é configurável por evento (`qa_upvote_enabled`).
- **Contador de presença e reações** (migração 0028): `presence_enabled` e
  `reactions_enabled` em `events`, toggles na aba Interações do EventForm
  (default `true`, preserva o comportamento anterior). Controlam só a UI
  (`PresenceBadge`, `ReactionBar`/`ReactionOverlay` em `EventRoom.tsx`);
  `useReactions` recebe `enabled` e só assina o canal Realtime quando
  ligado, pra não gastar canal à toa com a reação desligada.
- Blocklist de texto livre: tabela `banned_words` (match por palavra inteira).
- **Sorteios** (tabela `raffles`, permissão `can_quiz`): só via RPC
  `run_raffle` — semente + md5 determinístico, sem policy de UPDATE (log
  imutável, CSV de auditoria); exibição no telão via `raffle_display`.
- **Evento encerrado/on demand** (`status = 'ended'` ou `'ondemand'`,
  migrações 0025–0027): banner "EVENTO ENCERRADO" (dentro da área do
  player, mesmo lugar do aviso de "agendado" — nunca uma barra separada no
  topo) e trava as interações do participante em qualquer um dos dois
  status — chat (input some, histórico continua visível, sem exceção nem
  pra quem entra como staff via Sala do evento — o Diretor é outro
  componente e não é afetado), Q&A (form some, voto desabilita), fotos
  (upload some, grade continua), atividades (aba Interação e overlay do
  player somem). Defesa em profundidade: as RPCs de escrita
  (`submit_activity_response`, `answer_question`, `submit_question`,
  `toggle_question_vote`, `submit_photo`) rejeitam se `events.status <>
  'live'`. Chat já tinha essa trava via RLS (`posts_insert_participant`,
  migração 0001). `'ondemand'` é status manual (botão "Deixar on demand"
  no Diretor, só aparece depois de encerrar): mantém o player tocando o
  mesmo `stream_ref` (vira VOD sozinho no provedor) mas trava interação
  igual a `'ended'` — `get_room_event` libera a fonte do vídeo pra
  `'live'` e `'ondemand'`, só esconde pra `'draft'/'scheduled'/'ended'`.
- **Player white-label** (`YouTubePlayer.tsx`/`VimeoPlayer.tsx`): sem
  controles/logo/título nativos (sem zoom/crop — cortava imagem, removido).
  Autoplay tenta iniciar com som (`mute: 0`); se o navegador bloquear
  autoplay não-mudo, o player fica parado até o clique manual em
  "Assistir" (gesto real, som libera nele). O estado `muted` da UI nunca é
  assumido — é sincronizado a cada poll a partir de `player.isMuted()`,
  porque o navegador pode forçar mudo por conta própria mesmo com
  `mute: 0`. Controles próprios: play/pause, volume, tela cheia, barra de
  progresso/voltar (só aparece se `getDuration() > 0`, ou seja, se a
  transmissão tiver DVR habilitado; arrasto usa estado local — só chama
  `seekTo` ao soltar, não a cada tique, senão dispara buffer repetido) e
  legenda (módulo `captions` da IFrame API — precisa de `loadModule` no
  `onReady` pra `getOption("captions","tracklist")`/`"track"` retornarem
  algo). Testado com print de tela num vídeo real de produção (legenda
  automática/ASR): (1) `getOption("captions","tracklist")` fica **vazia**
  pra legenda automática — só aparece via `getOption("captions","track")`,
  mesmo sem ninguém ter ativado nada, então a checagem de disponibilidade
  do botão usa os dois; (2) `cc_load_policy: 0` + limpar a faixa **uma vez**
  no `onReady` não é suficiente — o YouTube reaplica a legenda automática
  preferida do espectador (conta/navegador dele) depois que o vídeo
  realmente começa a tocar, não só no carregamento inicial, então o
  intervalo de 500ms (o mesmo que já sincroniza `muted`/tempo) também
  reforça a limpeza a cada tique enquanto `captionsOn` for false —
  confirmado visualmente que só essa sondagem contínua remove a legenda de
  verdade da tela, o clear único não removia; (3) `getOption("captions",
  "track")` nunca reflete `setOption` (sempre retorna a faixa "preferida",
  ligada ou não), então **não** dá pra usar como fonte da verdade do botão
  — `captionsOn` é só estado local (o que o usuário pediu). Se mesmo com
  tudo isso a legenda ainda aparecer, é preferência pessoal da conta/
  navegador do YouTube do espectador (configuração de acessibilidade do
  Google), fora do alcance do embed.
  **Sem seletor de qualidade** (removido, tinha via `setPlaybackQuality`):
  o YouTube trata isso como sugestão desde 2018 e ignora o pedido tanto em
  live quanto em VOD (testado e confirmado) — não existe forma de forçar
  qualidade num embed do IFrame API hoje, então não expomos o controle.
  `stream_ref` não vai no HTML inicial
  nem no Realtime bruto da tabela `events` (vazava a linha inteira) — a
  sala usa `get_room_event` (RPC, polling autenticado) que só inclui a
  fonte quando `status` é `'live'` ou `'ondemand'`.
  `DisableInspect.tsx` bloqueia clique-direito e atalhos comuns (F12,
  Ctrl+Shift+I/J/C, Ctrl+U) na sala e no telão — **best-effort, não é
  segurança real**: o navegador reserva F12/menu de DevTools independente
  de JS, e a requisição ao YouTube/Vimeo sempre aparece na aba Network.
  Ocultar de verdade só com streaming próprio (Fase J).
- **UI sem scroll** nas áreas de interação: ou pagina, ou cabe na tela
  (regra do Marcelo). Chat/listas rolam só internamente.
- Textos da UI em pt-BR; CSVs e datas em formato brasileiro.
- **`<input type="datetime-local">` não faz conversão de fuso sozinho** —
  `events.starts_at` é UTC no banco; popular o input exige converter pra
  hora local primeiro (`toLocalDatetimeInputValue` em `EventForm.tsx`),
  senão o admin edita um horário e o formulário mostra outro (bug real
  corrigido em 21/07/2026: admin via 20:20, front mostrava 17:20 certo).
- **Cadastro em evento (`EntrarFlow.tsx`)**: nome/sobrenome são pedidos na
  criação de conta (junto com senha), não mais numa etapa separada depois
  do login — evita repetir pergunta que devia ter sido feita uma vez só.
  Fluxo "esqueci a senha"/código continua sem pedir nome ali (a pessoa
  pode já ter conta sem nome salvo) e Google já traz o nome pronto
  (trigger `handle_new_user`, migração 0001). A etapa "cadastro" (nome +
  campos extras + consentimento) só aparece de fato se o evento tiver
  campo extra (`event_fields`) ou `consent_text` — sem isso, com nome já
  conhecido, registra automaticamente e pula pra sala (sem piscar
  formulário).
- **Ações destrutivas sempre com `confirm()`** (banir, apagar mensagem/foto/
  pergunta/resposta) — padrão consolidado após revisão `/impeccable critique`
  em 19/07/2026; qualquer exclusão nova segue o mesmo padrão.
- **Exclusão de agência/cliente/evento/pessoa da equipe** (migração 0024):
  agência e cliente só excluem se não tiverem dependentes (RLS + FK sem
  cascade — bloqueia com erro amigável em vez de apagar tudo em cascata);
  evento já cascata sozinho (inscrições/chat/quiz/fotos/sorteios). Remover
  pessoa da equipe de cliente/agência (`OrgTeam.tsx`) já vale pra admin
  também — trigger `enforce_last_{client,agency}_admin` bloqueia só quando
  seria o último admin (remoção ou rebaixamento). Excluir conta de verdade
  (usuário com ou sem `is_platform_admin`) só na tela `/admin/equipe`
  (`TeamList.tsx`) via rota `/api/admin/users/[id]` — usa a Admin API do
  Supabase (`SUPABASE_SERVICE_ROLE_KEY`, server-only, nunca no client),
  porque `auth.users` não tem RLS; ninguém exclui a própria conta por ali.
  `posts`/`questions`/`event_photos.author_id` e `events.created_by` viram
  `null` (`on delete set null`) em vez de bloquear ou apagar o conteúdo
  histórico quando o autor é excluído (nome já denormalizado em
  `author_name`).
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
- **Tema por tela**: só `[clientSlug]/page.tsx` (vitrine, escolha de evento)
  é clara — usa `bg-white`/`text-neutral-900`/`border-neutral-200` com a
  cor da marca do cliente (`--brand`) carregando CTA/foco/hover. A partir
  daí (`EntrarFlow.tsx`, login do organizador, sala, Diretor, telão) tudo é
  onix — decisão revisada na Fase C: tema claro só na "capa" de navegação
  entre eventos, nunca dentro do fluxo de entrada/participação em si (ficava
  destoante entrar claro pra cair numa sala escura logo em seguida).
- **Abas dentro de uma tela** (sem mudar de URL, ex.: Configuração do
  evento): estado local (`useState`) + classe `hidden` pra alternar — nunca
  desmontar o conteúdo da aba (perde estado não salvo). Ver
  `EventForm.tsx`'s `extraTabs` para injetar abas de componentes irmãos
  (Materiais, Equipe) só quando fazem sentido (evento já existe).
- **Landing pública ("/", GoLive)**: página institucional virou landing de
  vendas (`web/src/components/landing/`), tema claro isolado do onix do
  produto via classe `.gl-landing` em `globals.css` (não mexe nos tokens
  onix globais) — paleta full-palette com cor por função (`--gl-brand`
  indigo, `--gl-quiz` violeta, `--gl-chat` teal, `--gl-raffle` âmbar,
  `--gl-reaction` coral). "GoLive" é o nome de marketing da plataforma;
  não menciona a Propano Filmes na landing (pedido explícito do Marcelo).
- **Ambiente de teste compartilhado** (`/demo`, migração 0029): cliente
  fixo "Cliente Demo" com dois eventos — `evento-modelo` (`status='draft'`,
  editado normalmente pelo `/admin`, é onde a configuração "oficial" do
  demo vive) e `evento` (`status='live'`, id fixo, é o que os dois logins
  públicos usam de verdade). RPC `reset_demo_event()` roda via `pg_cron` a
  cada 4h: apaga o evento "ao vivo" e recria copiando as colunas atuais do
  `evento-modelo` (cascade do Postgres já limpa chat/quiz/fotos/sorteios/
  inscrições) — ou seja, o que se configura no modelo pelo admin normal
  vira o padrão que sobrevive ao reset; só o que visitantes mexeram no
  evento ao vivo entre um reset e outro é que se perde. O reset também
  restringe `client_members` do cliente demo só ao admin oficial e limpa
  convites pendentes — fecha a brecha de alguém se auto-promover ou
  convidar terceiros usando o login público. Login fixo (sem depender de
  caixa de entrada real, `email_confirm: true` na criação via
  `scripts/seed-demo-users.mjs`, script avulso — não é migração porque
  mexe em `auth.users` via Admin API):
  `demo@golive.net.br` / `participante@golive.net.br`, senha `golive`
  pros dois. Limitação aceita: atividades do tipo quiz não são copiadas do
  modelo pro evento ao vivo (dependem de `quizzes`/`quiz_questions` à
  parte, exigiria remapear IDs); arquivos de Storage (fotos/materiais/logo)
  não são apagados pelo cascade, ficam órfãos no bucket (baixo volume
  esperado, sem cron de limpeza dedicado por enquanto).

## Estado (22/07/2026)

Fases concluídas: MVP, multi-tenant A–D, E (motor de atividades completo),
F (Q&A com upvote), G (chat pré-moderado, galeria de fotos com moderação
obrigatória, materiais p/ download — buckets `gallery` e `materials`),
H (sorteios auditáveis no Diretor + telão), I (player YouTube white-label —
`YouTubePlayer.tsx`, IFrame API, capa própria, sem migração). Revisão de
UX/UI completa (`/impeccable critique`) nas 3 telas centrais — ver ROADMAP.
Reestruturação de navegação (`/impeccable shape`, ver `web/PRODUCT.md`):
Fases A–D concluídas (shell + tokens onix, paleta onix + lucide-react,
vitrine pública clara, abas na Configuração), mais D.1 — revisão pós-
feedback: aba Interações com `enabled_activity_types`, Q&A com aprovação
sempre obrigatória, sidebar lateral trocada por navbar superior,
zoneamento visual em cartões, logos maiores nos pontos de entrada — ver
ROADMAP. Landing pública "GoLive" (`/impeccable`, 21–22/07/2026): landing
de vendas completa em `/` (hero, vitrine de recursos, demo interativa,
white-label, painel Diretor, FAQ) + ambiente de teste compartilhado em
`/demo` com reset automático (migração 0029, ver Convenções do produto).
Próxima fase de produto: J (streaming próprio). Pendências avulsas: Google
OAuth (falta credencial), upload de planilha p/ allowlist, evento-piloto
em produção.
