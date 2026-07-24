# Arquitetura

## Visão geral

```
┌──────────────────────────────────────────────────────────────────┐
│                      Next.js 16 (Railway)                        │
│                                                                    │
│  /[clientSlug]                  → vitrine pública do cliente      │
│  /[clientSlug]/[eventSlug]      → sala do evento (player+chat+…) │
│  /[clientSlug]/[eventSlug]/entrar → cadastro/login do participante│
│  /e/[slug]                      → rota legada (evento sem cliente)│
│  /telao/[eventId]               → telão OBS/vMix, público (UUID)  │
│  /login, /senha/nova            → acesso da equipe (organizador)  │
│  /admin/...                     → agências, clientes, eventos,    │
│                                    Sala de produção (Diretor)      │
│  /admin/eventos/[id]/estudio    → Estúdio WebRTC (Diretor) 🚧     │
│  /estudio/[id]/guest|output     → convidado / saída OBS 🚧        │
│                                                                    │
│  Player: YouTube | Vimeo | Dacast | HLS (stand by) | studio 🚧   │
└──────────────┬───────────────────────────────────┬────────────────┘
               │ supabase-js (RLS aplicado no banco) │ LiveKit (WebRTC)
               │                                     ▼
               │                       ┌─────────────────────────────┐
               │                       │  LiveKit (servidor de mídia) │
               │                       │  salas studio-<eventUUID>,   │
               │                       │  token/stage via server-sdk  │
               │                       └─────────────────────────────┘
┌──────────────▼─────────────────────────────────────────────────────┐
│                            Supabase                                │
│  Postgres  → multi-tenant, eventos, atividades, chat, Q&A,        │
│              galeria, materiais, sorteios, relatórios              │
│  Auth      → e-mail (senha ou código OTP) + Google OAuth           │
│  Realtime  → chat, atividades, presença (~1000 conexões/evento)   │
│  Storage   → branding, gallery, materials (buckets públicos)       │
└──────────────────────────────────────────────────────────────────┘
```

## Decisões

1. **Supabase Realtime em vez de WebSocket próprio** — chat, atividades e
   presença usam canais do Supabase. ~1000 conexões simultâneas cabem no
   plano Pro sem operar infraestrutura própria.
2. **Player com adaptadores** — a fonte do vídeo é configuração do evento
   (`stream_provider` + `stream_ref`). Trocar YouTube por Dacast, ou pelo
   HLS próprio na Fase J, não muda a página do evento.
3. **RLS (Row Level Security) em tudo** — o frontend fala direto com o
   Supabase; as políticas no banco garantem que cada papel só lê/escreve o
   que pode. Regras de negócio sensíveis (gabarito de quiz, sorteio,
   moderação) vivem em funções `security definer`, não só em RLS declarativa
   — ver "Padrões de segurança" abaixo.
4. **Multi-tenant como hierarquia real no schema** — Agência → Cliente →
   Evento, com equipes (`*_members`) e convites por e-mail em cada nível;
   evento pode existir sem cliente (`client_id` nulo).
5. **Fase J (streaming próprio)** — dois braços. **J.1 (HLS via provedor:
   Cloudflare/Mux/IVS)** está em **stand by**. **J.2 — Estúdio WebRTC
   "GoLive Studio" (LiveKit)** está EM CONSTRUÇÃO: estúdio ao vivo
   multi-convidado (Diretor + convidados na mesma sala) com mixagem de cena
   e saída limpa pro OBS, estilo Restream/StreamYard. LiveKit é o servidor
   de mídia (WebRTC); o Next só emite tokens JWT e comanda o palco via
   `livekit-server-sdk`. Ver "Estúdio GoLive" no modelo de dados.

## Modelo de dados

### Identidade

- **`profiles`** — espelho de `auth.users` (criado via trigger
  `handle_new_user()`): `id`, `full_name`, `email` (desnormalizado),
  `avatar_url`, `is_platform_admin`, `is_moderator`.

### Hierarquia multi-tenant (agência → cliente → evento)

- **`agencies`** (`id`, `name`) — camada opcional, nunca aparece em URL
  pública. **`agency_members`** (`agency_id`, `user_id`,
  `role: admin|collaborator`) + **`agency_invites`** (convite por e-mail,
  ativa no cadastro).
- **`clients`** (`id`, `agency_id` opcional, `name`, `slug` único,
  `folder_visibility: public|restricted|private`, cor/logo/fundos da
  marca). **`client_members`** + **`client_invites`** no mesmo padrão de
  agência — admin/membro de agência **herda** acesso a todo cliente daquela
  agência.
- **`event_members`** — as "5 caixas" de permissão por evento: `event_id`,
  `user_id`, `can_stream`, `can_chat`, `can_quiz`, `can_registrations`,
  `can_reports` (booleanos).

### Eventos

- **`events`**: `id`, `slug` (único), `title`, `description`, `cover_url`,
  `starts_at`/`ends_at`, `status: draft|scheduled|live|ended|ondemand`
  (`ondemand`, migração 0026, é setado manualmente pelo Diretor depois de
  encerrar — mantém o player tocando a gravação com interação travada
  igual a `ended`; `created_by` vira `null` se o autor for excluído em vez
  de bloquear, migração 0024),
  `stream_provider: youtube|vimeo|dacast|hls`, `stream_ref`, `client_id`
  (nulo permitido), `listed_on_client_page`, `accept_client_base`.
  - **Inscrição**: `registration_mode: open|allowlist|domain`,
    `require_approval`, `allowlist_fallback_approval`, `allowed_domains
    text[]`, `consent_text` (LGPD), `google_login_enabled`, `capacity`.
  - **Interações**: `chat_enabled`, `chat_moderation`, `gallery_enabled`,
    `qa_enabled`, `qa_allow_anonymous`, `qa_upvote_enabled`,
    `enabled_activity_types text[]` — quais dos 7 tipos de atividade o
    evento pode usar (migração 0023; ver "Atividades" abaixo).
  - **Identidade visual**: `brand_color`, `brand_logo_url`, `bg_image_url`,
    `bg_image_mobile_url`, `card_image_url`, `sponsor_logos jsonb`.
  - Existe ainda uma coluna `access_mode` (enum antigo, pré-multi-tenant)
    mantida só por um trigger de compatibilidade — não é mais a fonte da
    verdade (isso é `registration_mode`) e pode ser removida quando não
    houver mais nada lendo dela diretamente no banco.
- **`event_fields`** — campos de cadastro personalizados: `event_id`,
  `label`, `field_type: text|select|checkbox`, `required`, `options jsonb`,
  `position`.
- **`event_allowlist`** — `event_id`, `email`, `added_by` (lista de
  convidados para `registration_mode = allowlist`).

### Inscrições e presença

- **`registrations`** — `event_id`, `user_id`,
  `status: pending|approved|rejected|banned`, `answers jsonb`,
  `consent_accepted_at`, único por `(event_id, user_id)`.
- **`event_attendance`** — `event_id`, `user_id`, `first_joined_at`,
  `last_seen_at`, `watch_seconds`; alimentada por heartbeat (RPC
  `touch_attendance`, a cada 60s do cliente) para os relatórios.

### Chat

- **`posts`** — `event_id`, `author_id` (`on delete set null`, migração
  0024 — exclusão de conta não apaga nem bloqueia a mensagem histórica),
  `author_name` (desnormalizado), `content`, `kind: message|announcement`,
  `pinned`, `deleted_at` (soft delete), `approved` (pré-moderação
  opcional, migração 0015), `reply_to_id` (resposta a outra mensagem, `on
  delete set null`). Insert de participante exige `events.status = 'live'`
  (`posts_insert_participant`, migração 0001) — chat fecha sozinho quando
  o evento encerra/vira on demand.

### Quiz

- **`quizzes`** (`event_id`, `title`, `status`) + **`quiz_questions`**
  (`quiz_id`, `prompt`, `options jsonb`, `time_limit_sec` — `0` = sem
  cronômetro, fecha junto com o lote; `status: pending|open|closed|revealed`)
  + **`quiz_keys`** (`question_id`, `correct_index`, RLS exclusiva de
  admin — o gabarito nunca trafega para participante, nem via select nem
  via Realtime; só vira visível quando `reveal_question` copia o valor
  para `quiz_questions.revealed_correct_index`) + **`quiz_answers`**
  (`question_id`, `user_id`, `selected_index`, único por par).
- View **`quiz_leaderboard`** agrega pontuação por `(event_id, user_id)` —
  1000 pts por acerto + bônus de velocidade (até 500, só quando a pergunta
  tinha cronômetro). Não é consultável direto — ver "Padrões de segurança".

### Atividades interativas ("Interações")

Motor único por trás de nuvem de palavras, enquete, quiz, escalas,
respostas abertas, ordenação e matrix 2×2 — modelo "slide ativo": uma
atividade aberta por vez, controlada via RPC `activity_control`
(`open|close|publish|unpublish|clear`).

- **`activities`** — `event_id`, `type` (word_cloud, poll, quiz,
  quiz_ranking, scale, open_text, ordering, matrix), `title`,
  `config jsonb` (formato varia por tipo: opções/afirmações/escala/
  rótulos/spotlight/eixos), `status: pending|open|closed`,
  `results_visible: live|after_publish`, `results_published`, `highlight`
  (abre em overlay sobre o vídeo), `require_moderation`, `position`,
  `quiz_id` (FK opcional/único para `quizzes` — atividades `type='quiz'`
  são só um ponteiro; perguntas/gabarito/respostas continuam nas tabelas
  de quiz de sempre).
- **`activity_responses`** — `activity_id`, `user_id`, `payload jsonb`
  (formato por tipo: `{word}`, `{option_index}`, `{ratings:[]}`, `{text}`,
  `{order:[]}`, `{xs:[],ys:[]}`), `approved` (moderação opcional em
  word_cloud/open_text).
- **`banned_words`** — blocklist de palavra inteira (regex `\m...\M`),
  aplicada a nuvem de palavras e respostas abertas.
- **`events.enabled_activity_types`** controla quais tipos aparecem pra
  criar na Sala de produção — validado tanto na UI (EventForm) quanto na
  policy de `activities` (`with check`), defesa em profundidade.
- `quiz_ranking` é um tipo sintético/singleton (não faz parte dos tipos
  criáveis normalmente): placar somado de todos os quizzes do evento,
  criado sob demanda pelo botão "Ranking geral" dentro de um quiz.

### Perguntas do público (Q&A)

- **`questions`** — `event_id`, `author_id` (`on delete set null`,
  migração 0024), `author_name` (desnormalizado, vazio se anônima),
  `is_anonymous`, `content`,
  `status: pending|visible|answered|rejected`, `votes_count`
  (desnormalizado, sincronizado por trigger). **Aprovação é sempre
  obrigatória** (migração 0023) — toda pergunta nasce `pending`, não existe
  mais modo "sem moderação".
- **`question_votes`** — `question_id`, `user_id` (PK composta); upvote
  configurável por evento (`events.qa_upvote_enabled`).

### Galeria de fotos

- **`event_photos`** — `event_id`, `author_id` (`on delete set null`,
  migração 0024), `author_name`, `storage_path`,
  `status: pending|approved|rejected`. Moderação é sempre obrigatória (sem
  toggle de configuração, diferente de chat/atividades).

### Materiais

- **`event_materials`** — `event_id`, `title`, `storage_path`,
  `file_name`, `file_size`, `mime_type`, `visible`, `added_by`.

### Sorteios

- **`raffles`** — `event_id`, `kind: participants|numbers|coin`,
  `visual: cards|wheel|coin`, `title`, `config jsonb`, `seed`,
  `entries jsonb` (snapshot do pool elegível no momento do sorteio —
  trilha de auditoria), `result jsonb`, `displayed`, `drawn_by`. **Sem
  policy de UPDATE** — log imutável por design; a única escrita depois do
  insert é `displayed`, feita exclusivamente pela RPC `raffle_display`.

### Estúdio GoLive (WebRTC / LiveKit) — 🚧 EM CONSTRUÇÃO (migração 0032)

Estado do estúdio ao vivo por evento + os assets visuais mixáveis. **Ainda
instável, muitas melhorias pendentes** (ver ROADMAP J.2). O vídeo/áudio em
si trafega pelo **LiveKit** (fora do Supabase); o Postgres guarda só o
*estado de cena* que o Diretor controla e todos os clientes espelham.

- **`studio_rooms`** — 1 linha por evento (`event_id` único): `active_layout`
  (`solo|grid|split|spotlight|presentation`), `active_scene_id`,
  `spotlight_participant_id`, `active_banner_id`, `active_ticker_text`,
  `active_overlay_url`, `active_background_url`, `active_logo_url`,
  `active_presentation_id`, `active_slide_index`. RLS: leitura liberada
  (authenticated **e** anon — a rota `/output` do OBS não tem sessão);
  escrita = `has_event_role(_,'stream')` OU admin do cliente OU
  `is_admin()`.
- **`studio_assets`** — biblioteca de peças por evento: `asset_type`
  (`gc_name|banner|ticker|logo|overlay|background|video_clip|presentation`),
  `title`/`subtitle`, `content_json`, `file_url`, `sort_order`,
  `is_default`, `created_by`. Mesma RLS de `studio_rooms`.
- `stream_provider` ganhou o valor `'studio'` (evento cuja fonte é o
  próprio estúdio, não YouTube/Vimeo).
- **Salas LiveKit** têm nome `studio-<eventUUID>` — Diretor e convidado
  entram na mesma resolvendo slug→UUID no `/api/studio/token`. Palco vs
  backstage é o atributo `isOnStage` do participante, setado pelo
  `/api/studio/stage` (via `RoomServiceClient.updateParticipant`).
- **Lacunas conhecidas** (ROADMAP J.2): `studio_rooms` **não está** na
  publicação `supabase_realtime` apesar de guest/output assinarem
  `postgres_changes` nela — a sincronia de cena por Realtime não dispara
  ainda; e `/api/studio/token` não valida papel do "Diretor" (qualquer
  autenticado pega `roomAdmin`).

## RPCs principais (`security definer`)

- **Inscrição**: `register_for_event` — resolve `registration_mode`
  (open/domain/allowlist com fallback), aplica `require_approval`, exige
  aceite de consentimento quando `consent_text` está preenchido.
- **Quiz**: `answer_question`, `open_question`, `close_question`,
  `reveal_question` (todas exigem `has_event_role(event_id,'quiz')`);
  `reveal_question` é o único caminho pelo qual o gabarito vira visível.
  `get_quiz_leaderboard(p_event_id)` — wrapper seguro da view (ver abaixo).
- **Atividades**: `submit_activity_response` (valida por tipo; quiz/
  quiz_ranking são rejeitados aqui, passam por `answer_question`; migração
  0025 — rejeita se `events.status <> 'live'`, mesma regra de
  `answer_question`/`submit_question`/`toggle_question_vote`/
  `submit_photo`, defesa em profundidade além do filtro de UI),
  `get_activity_results` (liberado pra operadores sempre; pra participante
  só quando a atividade está aberta/fechada e o resultado é ao vivo ou já
  publicado), `activity_control` (a máquina de estados do "slide ativo"),
  `get_screen_state(p_event_id)` (fonte de dados do telão — pública,
  retorna só agregados anônimos + identidade visual, nunca respostas cruas).
- **Q&A**: `submit_question` (checa `qa_enabled`, limite de 300
  caracteres, blocklist, permissão de anônima; sempre insere `pending`),
  `toggle_question_vote` (checa `qa_upvote_enabled` e pergunta visível).
- **Galeria**: `submit_photo` (checa `gallery_enabled`, caminho de storage
  bate com `event_id/user_id/...`, limite de 10 fotos/pessoa, sempre
  `pending`).
- **Sorteios**: `run_raffle` (lógica por tipo — moeda via paridade de bit
  do md5, números/participantes via ranking por
  `md5(semente || chave)` — determinístico e reproduzível fora do
  sistema), `raffle_display`, `get_displayed_raffle` (polling leve pro
  overlay da sala).
- **Presença**: `touch_attendance` (heartbeat, 60s, clamp 0-300s).
- **Sala**: `get_room_event(p_event_id)` — evento sem `stream_ref`/
  `stream_provider` a menos que o chamador tenha acesso real E o evento
  esteja `live` ou `ondemand` (migração 0027 — sem isso o player nunca
  tocaria a gravação em on demand; ver "Padrões de segurança").
- **Multi-tenant**: `invite_to_client`/`invite_to_agency` (convite por
  e-mail, existente ou não), `set_moderator` (só admin da plataforma),
  `get_public_client`/`get_client_slug` (resolução pública sem expor a
  tabela `clients` direto ao anônimo).

## Modelo de permissões

Camadas que se somam por OR (qualquer uma verdadeira libera acesso):

1. **`is_platform_admin`** (coluna em `profiles`) → `is_admin()`.
   Superusuário global.
2. **`is_moderator` + `is_platform_admin`** → `is_staff()`. Flag global
   pré-multi-tenant, hoje residual (usada em pouquíssimos lugares como
   `event_attendance`), majoritariamente substituída pelo sistema de
   papéis por cliente/evento abaixo.
3. **Cliente**: `client_members` → `is_client_admin()`/
   `is_client_member()` — admin/membro de agência herda acesso a todo
   cliente daquela agência.
4. **Agência**: `agency_members` → `is_agency_admin()`/
   `is_agency_member()`.
5. **Evento (geral)**: `can_manage_event(event_id)` =
   `is_staff()` OU (`events.client_id` setado E
   `is_client_admin(client_id)`).
6. **Evento (granular)**: `has_event_role(event_id, capacidade)`, onde
   capacidade ∈ `{stream, chat, quiz, registrations, reports}` =
   `can_manage_event(event_id)` OU a caixa correspondente em
   `event_members`. **É a função mais usada do sistema** — quase toda
   policy e RPC de operador passa por ela.
7. **Participante**: `is_approved_participant(event_id)` = inscrição
   aprovada nesse evento, OU (evento tem `accept_client_base=true` E o
   usuário é participante aprovado de qualquer evento do mesmo cliente).

`can_quiz` é rotulado "Quiz e interações" na UI — cobre todo o motor de
atividades (não só quiz literal) e sorteios. Moderação de chat, Q&A e
galeria de fotos usa `can_chat`.

## Padrões de segurança

- **View com dono bypassando RLS** (corrigido na migração 0022): uma view
  sem `security_invoker` roda a checagem de RLS das tabelas de base como o
  *dono* do objeto, não como quem consulta — então `quiz_leaderboard`
  (dono = quem criou as tabelas, não sujeito às próprias policies) vazava
  ranking de qualquer evento/cliente pra qualquer autenticado via REST
  direto. Corrigido revogando `select` direto da view de
  `anon`/`authenticated` e criando `get_quiz_leaderboard()`, RPC que
  valida `has_event_role` antes de consultar a view internamente. Esse é o
  padrão a repetir se surgir outra view agregada sem RLS própria.
- **Gabarito isolado**: `quiz_keys` é tabela separada de `quiz_questions`
  justamente pra resposta certa nunca aparecer num `select *` ou payload
  de Realtime destinado a participante.
- **`stream_ref` fora do payload inicial e do Realtime bruto** (migração
  0020): a tabela `events` continua com RLS que permite participante ler a
  linha (a página de entrada precisa dos metadados), mas `stream_ref`/
  `stream_provider` são removidos do HTML inicial e do broadcast bruto do
  Realtime — a sala consulta `get_room_event()` em vez disso, que só
  inclui a fonte quando `status` é `live` ou `ondemand` (migração 0027) e
  quem pede tem acesso de fato.
  Isso não esconde a requisição ao provedor em si (sempre aparece na aba
  Network) — só tira do payload inicial e do broadcast, que vazavam a
  linha inteira a cada troca de status.
- **Helpers internos sem grant público**: `activity_results` e o miolo de
  `activity_control` têm `execute` revogado de `public`/`anon`/
  `authenticated` — só são alcançáveis pelas RPCs públicas que os
  encapsulam (`get_activity_results`, `get_screen_state`,
  `activity_control`), então não dá pra invocar a agregação direto e pular
  a checagem de permissão que vive no wrapper.
- **`enabled_activity_types` em profundidade** (migração 0023): a UI do
  EventForm já filtra os tipos disponíveis pra criar, mas a policy de
  `activities` também revalida `type = any(enabled_activity_types)` direto
  contra a linha de `events` — um tipo desabilitado não dá pra criar nem
  chamando a API direto, sem passar pela UI.
- **Sorteios são append-only**: não existe policy de UPDATE na tabela
  `raffles`; a única mutação depois do insert é `raffle_display()`
  (security definer, exige `can_quiz`), que é a única escritora. Somado ao
  sorteio determinístico por semente, é essa combinação que sustenta o
  "auditável": qualquer um com a semente e o snapshot de elegíveis
  reproduz os ganhadores de fora do sistema.
- **Autor sempre vê o próprio conteúdo em moderação**: quando algo está
  pendente/rejeitado/apagado, o autor continua vendo o próprio item (com
  selo "removida/pendente") em vez de sumir sem explicação — corrigido
  explicitamente em `posts` na migração 0021, já existia em
  `event_photos` desde a 0016, e `questions`/`activity_responses` seguem o
  mesmo formato (`author_id = auth.uid()` OR-ado na policy de select).
- **Nome do autor desnormalizado**: `posts.author_name`,
  `event_photos.author_name`, `questions.author_name` são gravados no
  insert (trigger ou RPC) em vez de vir de um join com `profiles` — evita
  ter que liberar select amplo em `profiles` só pra exibir nome em feed.
- **Caminho de Storage como autorização implícita**: as policies de
  `gallery`/`materials` parseiam `storage.foldername(name)` pra extrair
  `event_id`/`user_id` e checar permissão contra isso — a estrutura de
  pasta É a fronteira de autorização (upload em `gallery` exige que o
  segmento de user-id do caminho bata com `auth.uid()`).
- **Exclusão bloqueada por dependente, nunca em cascata silenciosa**
  (migração 0024): `agencies`/`clients` não têm `on delete cascade` pros
  filhos (`clients.agency_id`, `events.client_id`) — excluir uma agência
  com clientes, ou um cliente com eventos, estoura violação de FK em vez
  de apagar tudo embaixo. `events` já cascata sozinho pros filhos
  (inscrições/chat/quiz/fotos/sorteios/atividades — todos com `on delete
  cascade` desde suas migrações originais), então excluir evento é seguro
  direto. `friendlyError.ts` traduz a violação de FK genérica numa
  mensagem pedindo pra excluir os dependentes primeiro.
- **Trigger de "último admin"** (migração 0024): `client_members`/
  `agency_members` têm trigger `before delete or update of role` que
  bloqueia remover ou rebaixar o único admin restante da organização —
  cobre tanto a remoção manual (`OrgTeam.tsx`) quanto a cascata de excluir
  a conta de um admin (a linha de `client_members`/`agency_members` seria
  apagada junto via `on delete cascade` de `user_id`; o trigger intercepta
  antes).
- **Exclusão de conta real via Admin API, não RLS** (migração 0024):
  `auth.users` não é uma tabela comum — não tem RLS, só a Admin API do
  Supabase (`service_role`) apaga de verdade. Único lugar do sistema que
  usa a service role key (`src/lib/supabase/admin.ts`, server-only) fora
  do padrão RLS/RPC — uma Route Handler (`/api/admin/users/[id]`,
  método DELETE) confere `is_platform_admin` do chamador via cliente
  normal (cookies) antes de instanciar o cliente admin; bloqueia
  autoexclusão. `profiles` cascata de `auth.users` (migração 0001), e daí
  em diante tudo que referencia `profiles(id)` já está coberto pelos
  padrões acima (cascade ou `set null`).

## Realtime

Tabelas na publicação `supabase_realtime`: `posts`, `quiz_questions`,
`registrations`, `events`, `activities`, `event_photos`,
`event_materials`. Perguntas (`questions`/`question_votes`), respostas de
quiz, presença e sorteios **não** estão no Realtime — usam polling em
intervalo curto (RPCs leves como `get_displayed_raffle`), por serem menos
sensíveis a latência ou por já terem uma via de atualização otimista no
cliente.

⚠️ **`studio_rooms` ainda NÃO está na publicação** (migração 0032), embora
as telas do estúdio (`/estudio/[id]/guest` e `/output`) assinem
`postgres_changes` nela — por isso a sincronia de cena do estúdio via
Realtime não funciona ainda. Adicionar à publicação é uma das pendências
do Estúdio (ROADMAP J.2).

## Storage

- **`branding`** (público) — logos/fundos/cards de evento e cliente;
  upload liberado pra qualquer equipe (staff/membro de cliente/agência),
  exclusão só por admin da plataforma.
- **`gallery`** (público, 10 MB, JPG/PNG/WebP) — fotos de participantes,
  autorização pelo caminho (`event_id/user_id/uuid.ext`).
- **`materials`** (público, 100 MB, qualquer tipo) — materiais do evento,
  upload/exclusão por quem gerencia o evento ou tem `can_stream`.
- CSVs de relatório são gerados no cliente (Blob) e baixados direto — não
  existe bucket de relatórios.
- **Estúdio reusa buckets existentes** (sem bucket novo): peças gráficas do
  `StudioGraphicsPanel` (banners/GC/logos/overlays) vão pro `branding`;
  apresentações do `StudioPresentationManager` vão pro `materials`.

## Dívida técnica conhecida

- Coluna `events.access_mode` (enum pré-multi-tenant) é vestigial —
  substituída por `registration_mode` desde a migração 0004, mantida viva
  só por um trigger de compatibilidade. Candidata a remoção numa limpeza
  futura.
- `is_staff()`/`is_moderator` são um sistema de permissão global anterior
  ao multi-tenant, hoje residual — a maior parte do controle de acesso já
  passa por `has_event_role`/hierarquia de cliente-agência.
- **Estúdio WebRTC (LiveKit) — infra e segurança pendentes** (🚧): deps
  `@livekit/components-react`/`-core`/`livekit-client`/`livekit-server-sdk`;
  env `LIVEKIT_API_KEY`/`LIVEKIT_API_SECRET`/`NEXT_PUBLIC_LIVEKIT_URL`. Falta
  definir/provisionar o servidor LiveKit de produção, colocar `studio_rooms`
  no Realtime, e travar `/api/studio/token` por `has_event_role` (hoje
  qualquer autenticado vira `roomAdmin`, com fallback devkey hardcoded).
  Ver ROADMAP J.2 pra lista completa.
