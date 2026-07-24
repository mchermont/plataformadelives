# Roadmap

> Atualizado em 24/07/2026. Fases concluídas resumidas no fim do arquivo.
> Novidades recentes: landing GoLive + `/demo` (migração 0029–0031),
> rebrand navy+verde, e Fase J.2 — Estúdio WebRTC "GoLive Studio" (migração
> 0032, EM CONSTRUÇÃO); HLS/provedor (J.1) em stand by.

## Visão

Plataforma de lives white-label com gamificação: interações ao vivo estilo
Mentimeter, sorteios, galeria, materiais e moderação completa — operada por
agências/clientes num painel multi-tenant.

---

## Reestruturação de navegação e sistema visual — /impeccable shape

Brief completo em `web/PRODUCT.md` (registro, personalidade, princípios de
design, paleta onix aprovada). Implementação em 3 fases:

### Fase A — Shell de navegação compartilhado ✅ (19/07/2026)

- [x] Tokens de cor onix (`--bg`, `--surface`, `--border-c`, `--ink`,
      `--muted`, `--accent`) em `globals.css`, expostos como utilities
      Tailwind (`bg-bg`, `text-ink`, `text-muted`, `bg-accent` etc.) — zero
      matiz saturada própria da plataforma, todo o "orçamento de cor" fica
      com a marca do cliente (`--brand`, já existente)
- [x] `src/lib/admin/chains.ts`: `getClientChain`/`getEventChain`
      memoizados por request (React `cache()`) — evento/cliente/agência
      buscados uma vez só, reaproveitados entre layout e página
- [x] Breadcrumb (`Breadcrumb.tsx`) Agência→Cliente→Evento em toda a árvore
      `/admin`, via layouts aninhados `clientes/[id]/layout.tsx` e
      `eventos/[id]/layout.tsx` (elimina headers duplicados por página)
- [x] `EventSectionNav.tsx`: abas Configuração/Ao vivo/Inscrições/Relatório
      consistentes nas 4 subpáginas do evento
- [x] `AdminLayout` reescrito com sidebar (antes: 3 links soltos no topo);
      `<main>` sem `max-w` ambiente — a página decide sua própria largura
      (formulários se auto-limitam, tabelas/Diretor usam a largura toda)
- [x] Removido o hack de full-bleed (`w-screen`/`translateX`) do painel
      Diretor — sem `max-w` ambiente, não precisa mais escapar de nada;
      testado lado a lado com a sidebar sem sobreposição
- Verificado em navegador (dev server + login real): Clientes → Cliente →
  4 abas do evento (Diretor com dados reais de chat/vídeo ao vivo) →
  Agências → Agência. Teste de viewport mobile não confirmável nesta
  sessão (limitação da ferramenta de resize), mas usa o mesmo padrão
  responsivo (`hidden sm:flex`/`sm:hidden`) já validado em outras telas.

### Fase B — Sistema visual ✅ (19/07/2026)

- [x] **B.1** — paleta Tailwind sobrescrita centralmente em `globals.css`
      (`--color-neutral-950/900/800`, `--color-sky-300..950`,
      `--color-purple-300/500` → tons onix + grafite quente em OKLCH); todo
      uso existente de `bg-neutral-800`/`text-sky-400`/`bg-purple-500` passa
      a herdar a paleta nova sem tocar em cada arquivo
- [x] **B.2** — `lucide-react` instalado; emoji-como-ícone trocado por SVG em
      todo o chrome de interface (botões, badges, categorias de atividade,
      paginação, check/x/fechar) nos componentes de admin, sala, telão e
      players (YouTube/Vimeo). Emoji mantido só onde é celebração de
      verdade: `Reactions.tsx` (reações da sala), revelação de
      ganhador do sorteio (telão + overlay da sala + `RaffleManager`), e
      medalhas 🥇🥈🥉 do ranking. Setas de rótulo de eixo do gráfico Matrix
      2×2 também mantidas (não são "ícone", são notação do eixo). Indicador
      "● AO VIVO"/"● Ao vivo" (badge de transmissão) mantido como glyph —
      convenção consistente de "dot" de status, não ícone de ação
- Verificado: `tsc --noEmit` + `next build` limpos; conferência visual no
  painel Diretor (seletor de tipo de atividade, botão Encerrar
  transmissão, export CSV do Q&A) via dev server

### Fase C — Vitrine pública clara ✅ (19/07/2026)

Tema claro só em `/[clientSlug]` (vitrine do cliente, a "capa" antes de
escolher um evento). `EntrarFlow.tsx` (cadastro/login do participante,
compartilhado por `/[clientSlug]/[eventSlug]/entrar` e pela rota legada
`/e/[slug]/entrar`) **voltou pro onix** — feedback do Marcelo após ver ao
vivo: tema claro ali destoava da sala escura que vem logo depois no mesmo
fluxo (login → sala sem transição de tema fazia mais sentido). Decisão
revisada: só a vitrine (navegação entre eventos, "primeira impressão" da
marca do cliente) é clara; o gate de entrada de um evento específico já é
parte da experiência ao vivo (mesmo tema da sala/Diretor/telão) — variação
de tema fica reservada à fronteira "escolher evento" → "entrar num evento",
não dentro do próprio fluxo de entrada.

- [x] `[clientSlug]/page.tsx`: banner de imagem de fundo do cliente (quando
      houver) com gradiente até o branco sólido; grid de eventos em cards
      brancos (`border-neutral-200`, `shadow-sm`, hover eleva + borda na cor
      da marca do cliente); badge "Em breve"/"Encerrado" em pílula
      translúcida (`bg-white/90 backdrop-blur-sm`) legível sobre qualquer
      thumbnail; miniatura sem capa usa tinta suave da marca (`${brand}12`)
- [x] `EntrarFlow.tsx`: revertido para onix (era o estado antes desta fase);
      login do organizador (`/login`, `/senha/nova`), sala, Diretor e telão
      continuam onix sem mudança
- Verificado: `tsc --noEmit` + `next build` limpos; conferência visual da
  vitrine (com foto de capa + fallback sem capa, estado "AO VIVO", hover do
  card) via dev server.

### Fase D — Abas na tela de Configuração do evento ✅ (19/07/2026)

Página "Configuração" do evento tinha ficado comprida demais (todas as
seções empilhadas verticalmente + Materiais + Equipe soltos depois).
`EventForm.tsx` ganhou uma barra de abas interna (mesmo padrão visual do
`EventSectionNav`, mas em estado local — sem mudar de URL) com 3 abas
nativas: **Informações básicas** (título/slug/início/descrição/status +
Vídeo), **Controle de acesso e cadastro** (modo de inscrição/allowlist/
aprovação/recursos habilitados + Campos do cadastro) e **Identidade e
vínculo** (vínculo com o cliente + identidade visual white-label). Nova
prop `extraTabs` permite injetar abas adicionais só quando o evento já
existe — a tela de edição (`eventos/[id]/page.tsx`) passa **Materiais para
download** (`MaterialsManager`) e **Equipe e funções** (`EventTeam`) como
abas extras; o fluxo de criação (`eventos/novo`) continua só com as 3
nativas (evento ainda não existe, não há o que gerenciar ali). Trocar de
aba só alterna `hidden`/visível via CSS — nenhum componente desmonta, então
alterações não salvas em qualquer aba sobrevivem à navegação entre elas.
Botão Salvar/Cancelar só aparece nas 3 abas nativas (Materiais/Equipe já
salvam sozinhos, inline). Verificado: `tsc --noEmit` + `next build`
limpos; as 5 abas + o fluxo de criação (só 3 abas) conferidos no navegador.

### Fase D.1 — Revisão pós-feedback ✅ (20/07/2026, migração 0023)

Feedback do Marcelo depois de ver a Fase D em produção:

- **Interações vira aba própria**: Chat/Q&A/Galeria (que estavam dentro de
  "Controle de acesso e cadastro") + o toggle de Quiz (que não gateava nada
  em runtime, só existia no formulário) saem de lá. Quiz é substituído por
  `enabled_activity_types` — 7 checkboxes (nuvem de palavras, enquete,
  quiz, escalas, respostas abertas, ordenação, matrix 2×2) que controlam de
  fato quais tipos aparecem pra criar na Sala de produção (RLS de
  `activities` também valida, não só a UI).
- **Q&A**: aprovação deixa de ser opcional — toda pergunta nasce `pending`
  (RPC `submit_question`); upvote vira configurável por evento
  (`qa_upvote_enabled`, gate em `toggle_question_vote`).
- Menu Cliente/Agência/Equipe: sidebar lateral vira navbar superior
  (`admin/layout.tsx`) — a lateral reservava ~14rem fixos pra 3-4 links.
- Submenu de abas do EventForm/EventSectionNav: voltou a quebrar em 2
  linhas depois da aba nova — rótulos encurtados (Controle de acesso e
  cadastro→Acesso e cadastro, Identidade e vínculo→Identidade, Materiais
  para download→Materiais, Equipe e funções→Equipe) + nav vira pills numa
  barra só, sem `flex-wrap`/scroll.
- **Zoneamento visual** (referência: estúdio de transmissão do Vimeo): cada
  seção do EventForm e as colunas do painel da Sala de produção (Prévias/
  Atividades) ganham cartão próprio (`bg-neutral-900/40` + borda) — antes
  flutuavam soltas no fundo da página, sem separação visual clara entre
  "página" e "painel". Abas de nível superior (EventForm, EventSectionNav)
  passam de sublinhado pra pill preenchida no estado ativo.
- Paleta: roxo (badge "Agência") ganha hue próprio (290) — antes convergia
  pro mesmo tom do azul (68), ficavam idênticos.
- Cadastro: campos "Nome completo" único vira "Nome" + "Sobrenome"
  (concatenados em `full_name`); login por código força definir senha nova
  em seguida (participante e organizador).
- Entrada do evento: remove rótulo interno vazando pra UI ("Cadastro
  simples/..."); nome do cliente na vitrine some quando já há logo (evitava
  repetir); logos maiores nos pontos de entrada.

---

## Revisão de UX/UI — /impeccable critique ✅ (19/07/2026, migração 0021)

Crítica dual-agent (design review + detector/scan manual) nas três telas
centrais — sala do participante (`EventRoom.tsx`), painel Diretor
(`LiveControlRoom.tsx`) e formulário de evento (`EventForm.tsx`). Todos os
achados P0–P3 corrigidos nesta passagem:

- [x] Confirmação em toda ação destrutiva sem exceção: banir/apagar no chat,
      apagar foto (irreversível), excluir pergunta de Q&A, excluir pergunta de
      quiz, remover resposta da fila de moderação
- [x] Contador de pendências nas abas inativas do Diretor (perguntas/fotos)
- [x] Fluxo de allowlist no EventForm não ejeta mais o organizador: evento
      novo com allowlist mantém na própria edição em vez de navegar embora
- [x] Rejeição silenciosa corrigida (migração 0021 + frontend): mensagem/foto
      do próprio autor continua visível com selo "removida/rejeitada pela
      moderação" em vez de sumir sem explicação
- [x] Troca forçada de aba na sala removida (só o indicador pulsante convida,
      sem mover o foco de quem está digitando)
- [x] `max-w-2xl` nos formulários da coluna central do Diretor; prévia do
      telão ganhou modal de ampliar (clique abre versão maior)
- [x] Todos os ~20 campos do EventForm com `htmlFor`/`id` associando label ao
      controle; campo "Tipo" de campo personalizado ganhou label visível
- [x] Cancelar no EventForm usa o mesmo destino calculado do Salvar +
      confirmação de descarte se houver alterações não salvas
- [x] Controles de moderação/remoção (chat, fotos) acessíveis via
      `focus-within` além de hover — funcionam em touch/teclado
- [x] Abas da sala (até 5) com `overflow-x-auto` — rolam em vez de espremer
      texto em telas estreitas
- [x] Erros técnicos do Supabase traduzidos (`src/lib/friendlyError.ts`) no
      Diretor e no EventForm; erro do EventForm rola automaticamente até a
      visão (formulário longo, botão Salvar distante)
- [x] Placeholder do campo de transmissão muda por provedor
      (YouTube/Vimeo/Dacast/HLS)

Snapshots das críticas em `web/.impeccable/critique/`.

---

## Fase E — Motor de atividades interativas (estilo Mentimeter)

**Objetivo:** uma infraestrutura única de "atividades" ao vivo (abrir → coletar
respostas em tempo real → exibir resultado → exportar), sobre a qual cada tipo
é só uma variação de configuração + visualização.

**Decisões de design (18/07/2026, discutidas com o Marcelo):**

- Modelo "slide ativo": **uma atividade aberta por vez**, controlada pelo
  Diretor (abrir → fechar votação → exibir resultado → limpar/reabrir),
  com contador de respostas ao vivo e cronômetro opcional
- **Resultado para o participante configurável por atividade**: em tempo real
  na sala OU somente quando o diretor exibir (evita viés de voto)
- **Anonimato**: tela pública sempre anônima; export CSV identificado
  (quem respondeu o quê) para o relatório do cliente
- **UI da sala**: aba "Interação" com badge + auto-destaque (padrão do quiz);
  atividades marcadas como "destaque" abrem em **overlay sobre o vídeo**
- **Telão OBS**: rota de tela cheia com resultado ao vivo e fundo
  transparente/verde/artes — para compor dentro da transmissão via OBS/vMix
  (ou projetar em evento híbrido)
- **Moderação de texto livre**: blocklist automática sempre ativa + fila de
  aprovação prévia opcional por atividade
- **Permissão**: reusa a caixa "Quiz" (rótulo vira "Quiz e interações")
- Nuvem de palavras: até 3 envios por pessoa

### E.1 — Infra + primeiros tipos ✅ (18/07/2026, migração 0009)
- [x] Tabelas `activities` + `activity_responses` (config/payload JSON),
      RLS via `has_event_role('quiz')`, Realtime
- [x] Bloco "Atividades" no painel Diretor (fila, abrir/fechar/exibir/limpar)
- [x] Aba "Interação" na sala + overlay para atividades em destaque
- [x] Rota telão `/telao/[eventId]` (fullscreen, `?bg=transparent|green|dark|art`)
      — fora de /admin porque o browser source do OBS não tem sessão; a URL
      com o UUID do evento funciona como token e só expõe agregados anônimos
- [x] **Nuvem de palavras** (termos crescem por frequência, blocklist,
      moderação prévia opcional, até 3 envios/pessoa)
- [x] **Enquete de múltipla escolha** (barras % ao vivo; sem certo/errado —
      o quiz competitivo com gabarito e placar já existe)
- [x] Export CSV por atividade (padrão pt-BR dos relatórios, identificado)

**E.1b — Quiz unificado nas atividades ✅ (18/07/2026, migração 0010):**
o quiz saiu da aba própria e virou tipo de atividade (`activities.quiz_id` →
tabela `quizzes`, que segue dona de perguntas/gabarito/pontuação). Lançamento
em **rodadas**: "Abrir" abre todas as perguntas pendentes do quiz de uma vez
(ex.: 3 → fecha → adiciona 2 → abre → fecha → mais 3), "Exibir resultado"
revela gabarito + distribuição + "X de Y acertaram" + ranking do quiz (só
perguntas reveladas). Novo tipo **Ranking geral** (`quiz_ranking`): placar
somado de todos os quizzes da live, para abrir no encerramento (telão/sala).
Perguntas de quiz-atividade não têm cronômetro (fecham com a rodada; acerto
vale 1000 fixo, sem bônus de velocidade). Aba "Quiz" da sala e bloco "Quiz ao
vivo" do Diretor removidos (QuizPanel/QuizManager deletados; /admin/eventos/
[id]/quiz redireciona p/ /live). Quizzes antigos migrados automaticamente
para atividades.

### E.2 — Demais tipos ✅ (18/07/2026, migração 0011)
- [x] **Escalas** (slider 1–5 ou 1–10 por afirmação, rótulos das pontas;
      resultado = média em régua com marcador + distribuição no agregado)
- [x] **Respostas abertas** (cartões; até 3 envios de 200 caracteres;
      blocklist sempre; fila de moderação prévia opcional; diretor destaca
      resposta no telão via ⭐ na prévia — `config.spotlight`)
- [x] **Ranking (ordering)** (participante ordena com setas ↑↓; resultado
      por posição média, menor média = topo)

### E.3 — Avançado ✅ (18/07/2026, migração 0013)
- [x] **Matrix 2×2** (itens avaliados em dois eixos com sliders 1–5,
      paginado por item; resultado = pontos no quadrante pela média dos
      votos, com rótulos de eixo configuráveis)
- [x] Refinamentos do telão (chroma key via ?bg=green já existia; animação
      de entrada telao-in ao trocar de atividade). Temas ficam para depois
      junto do white-label do player (Fase I)

## Fase F — Q&A com upvote ✅ (18/07/2026, migração 0014)

**Objetivo:** perguntas do público com votação, o recurso mais pedido em
eventos corporativos.

- [x] Envio de pergunta com identificação **ou anônima** (config por evento:
      permitir anônimas sim/não; anônima esconde o nome na tela, mas o CSV
      do organizador é identificado)
- [x] Upvote nas perguntas dos outros (toggle ▲); ordenação por votos
- [x] Moderação: fila de aprovação opcional antes de aparecer para todos
      (config por evento); marcar como respondida; apagar; blocklist
- [x] Painel do apresentador no Diretor (aba Perguntas ao lado do chat;
      ordenar por votos/recentes)
- [x] Export CSV
- Config no EventForm: "Perguntas do público (Q&A)" + anônimas + moderação;
  aba "Perguntas" na sala só aparece com Q&A habilitado

## Fase G — Moderação e mídia ✅ (19/07/2026, migrações 0015–0017)

**Objetivo:** controle editorial total do que aparece na live + conteúdo de
apoio.

- [x] **Chat pré-moderado** (0015) — opção por evento no EventForm ("Aprovar
      mensagens do chat antes de publicar"). `posts.approved` definido por
      trigger no insert (operador de chat publica direto); participante vê a
      própria mensagem com selo "em moderação"; fila de aprovação no topo do
      ChatPanel para operadores (Diretor e sala); aprovação chega aos
      participantes via Realtime (UPDATE vira mensagem nova na posição certa).
      Colaboradores seguem podendo apagar/banir em qualquer modo
- [x] **Galeria de fotos dos participantes** (0016) — bucket próprio `gallery`
      (público, 10 MB, JPG/PNG/WebP no próprio Storage); envio via RPC
      `submit_photo` (sempre `pending`, máx. 10 fotos/pessoa); **moderação
      obrigatória** com fila na aba "Fotos" do Diretor (aprovar/rejeitar/
      apagar, moderação usa `can_chat`); aba "Fotos" na sala com grade das
      aprovadas + as próprias pendentes; autor pode remover a própria foto
- [x] **Materiais do evento** (0017) — bucket `materials` (100 MB); gestão na
      página do evento (`/admin/eventos/[id]`): upload, renomear, exibir/
      ocultar e apagar (permissão = gestor do evento ou `can_stream`); aba
      "Materiais" na sala aparece só quando há material visível, com ícone por
      tipo, tamanho e download direto; visibilidade reflete na hora (Realtime)

## Fase H — Sorteios ✅ (19/07/2026, migrações 0018–0019)

**Objetivo:** sorteios ao vivo com prova de lisura, integrados à base de
participantes.

- [x] **Sorteio entre participantes** — fontes: inscritos aprovados, presentes
      na sala agora (attendance < 5 min) ou lista colada (um nome por linha)
- [x] Regras: nº de ganhadores, excluir equipe (event_members + client_members,
      padrão ligado), excluir quem já ganhou nesta live
- [x] **Sorteio de números** — intervalo personalizado (máx. 100.000 números),
      quantidade por rodada, sem repetir números já sorteados no evento
- [x] **Visuais de sorteio** — bloco "Sorteios" no Diretor; no telão: cartões
      de revelação escalonada, roleta giratória (opt-in) e cara ou coroa com
      moeda animada; sorteio exibido tem prioridade sobre a atividade no
      get_screen_state ("📺 Exibir (sala + telão)" / "Ocultar"); na **sala**,
      overlay sobre o player com contagem regressiva de 5 s e revelação
      (RPC leve `get_displayed_raffle`, polling de 3 s — 0019)
- [x] **Auditoria** — sorteio roda no servidor (RPC `run_raffle`) com semente
      aleatória e algoritmo determinístico (ganhadores = menores
      md5(semente‖chave), reproduzível externamente); snapshot dos elegíveis +
      config + semente gravados na tabela `raffles`, **sem policy de UPDATE**
      (log imutável); export CSV de auditoria por sorteio; permissão =
      `can_quiz`
- [ ] Integração com redes sociais (comentários de Instagram/Facebook):
      **avaliar depois** — depende de APIs da Meta e revisão de permissões;
      fora do escopo próximo

## Fase I — Player white-label (YouTube sem cara de YouTube) ✅ (19/07/2026)

**Objetivo:** rodar vídeo do YouTube dentro de player próprio ocultando ao
máximo a identidade da origem. Sem migração (só frontend).

- [x] Wrapper com a YouTube IFrame API (`YouTubePlayer.tsx`): `controls=0`,
      `modestbranding`, `disablekb`, `fs=0`, sem título/overlays; controles
      próprios (play/pausa/volume/mudo/fullscreen no wrapper) que aparecem no
      hover, com selo "● Ao vivo"
- [x] Capa personalizada antes do play (`cover_url` → fallback
      `card_image_url`); overlay transparente bloqueia cliques na UI do
      YouTube; pausa e fim voltam para a capa (esconde a logo de pausa)
- [x] Vimeo: mesmo tratamento (`VimeoPlayer.tsx`, Player.js SDK,
      controls/title/byline/portrait desligados, dnt); Dacast segue no
      embed padrão
- [x] Autoplay mudo nos dois (exigência dos navegadores) + clique-direito
      bloqueado
- [x] `stream_ref`/`stream_provider` fora do HTML inicial e do Realtime
      bruto da tabela `events` (migração 0020, `get_room_event`) — só
      trafegam por RPC autenticada quando o evento está ao vivo. Limite
      reconhecido: a requisição ao provedor sempre aparece na aba Network
      do DevTools; ocultar isso por completo exige streaming próprio
      (Fase J)
- ⚠️ **Limite conhecido:** os termos do YouTube não permitem remover 100% a
  marca (a logo pode aparecer em pausa/fim). O caminho definitivo para
  white-label total é a **Fase J (streaming próprio)** — este player é a
  melhor aproximação possível enquanto isso

### I.1 — Controles avançados do player YouTube ✅ (21/07/2026)

- [x] **Qualidade**: botão com o nível atual (`setPlaybackQuality`/
      `getAvailableQualityLevels`); o YouTube pode ignorar a escolha manual
      e manter automático dependendo do vídeo — limite da própria API, não
      bug daqui
- [x] **Barra de progresso e voltar**: só aparece quando
      `getDuration() > 0` — depende do DVR da transmissão ao vivo estar
      habilitado do lado de quem transmite; sem DVR, a barra some sozinha
- [x] **Legenda**: botão liga/desliga via módulo `captions` da IFrame API;
      só aparece se o vídeo tiver alguma faixa disponível
- Vimeo (`VimeoPlayer.tsx`) não recebeu os mesmos controles nesta rodada
  (API bem diferente — Player.js) — avaliar se pedido depois

## Fase J — Streaming próprio

Sem dependência de YouTube/Vimeo — white-label de verdade. A execução tomou
um caminho diferente do planejado: em vez de só um provedor HLS de playback,
foi iniciado um **Estúdio de transmissão WebRTC multi-convidado** (ver
"Estúdio GoLive" abaixo). O braço HLS/provedor ficou em **stand by**.

### J.1 — Provedor HLS (RTMP → HLS) — ⏸️ STAND BY (24/07/2026)

Playback próprio via provedor sob demanda. Pausado — o foco virou o Estúdio
WebRTC. Retomar se/quando fizer sentido ter também ingestão RTMP de OBS/vMix
externos com entrega HLS em escala.

- [ ] Escolher provedor (Cloudflare Stream vs Mux vs AWS IVS) — custo/minuto,
      latência, DVR, região Brasil
- [ ] `HlsAdapter` no player (hls.js) — slot já existe
- [ ] Painel: criar transmissão → URL RTMP + stream key para OBS/vMix
- [ ] Estado da transmissão via webhook; estimativa de custo por live
- [ ] Gravação/VOD pós-live

### J.2 — Estúdio de transmissão WebRTC "GoLive Studio" — 🚧 EM CONSTRUÇÃO (migração 0032)

Estúdio ao vivo estilo Restream/StreamYard sobre **LiveKit** (WebRTC, não
o provedor HLS). Diretor + convidados na mesma sala, mixagem de cena e saída
limpa pro OBS. **Ainda instável — muitas melhorias pendentes; mexer aqui é
trabalho conjunto com o Marcelo, não assumir que está pronto.**

Base já construída:
- [x] Migração 0032: `'studio'` no enum `stream_provider`; tabelas
      `studio_rooms` (estado de palco por evento) e `studio_assets`
      (banners, GCs de nome, tickers, logos, overlays, vinhetas,
      apresentações); RLS de escrita = `has_event_role(_,'stream')`/admin.
- [x] Dependências LiveKit (`@livekit/components-react`, `-core`,
      `livekit-client`, `livekit-server-sdk`); env `LIVEKIT_API_KEY`,
      `LIVEKIT_API_SECRET`, `NEXT_PUBLIC_LIVEKIT_URL`.
- [x] Rotas: `/admin/eventos/[id]/estudio` (Diretor), `/estudio/[id]/guest`
      (convidado), `/estudio/[id]/output` (saída OBS limpa), +
      `/[clientSlug]/[eventSlug]/estudio` e `/e/[slug]/estudio`.
- [x] APIs: `/api/studio/token` (JWT do LiveKit; Diretor e convidado caem
      na MESMA sala `studio-<uuid>` resolvendo slug→UUID) e
      `/api/studio/stage` (palco↔backstage via atributo `isOnStage`).
- [x] Componentes (`src/components/admin/studio/`): ControlRoom, Canvas,
      OutputCanvas, BackstageBar, GraphicsPanel (banners/GC/ticker/logo/
      overlay), PresentationManager (slides), PrivateChat (chat da equipe),
      ClientLoader (`dynamic ssr:false` — SDK WebRTC não roda no SSR).
- [x] Fase 6 (commit): apresentação de slides, output OBS limpo, chat
      privado da equipe; toggle backstage/palco; fallback de câmera nativa
      do browser; upload real de arquivos (PDF/imagens/logos).

Lacunas conhecidas / a fazer:
- [ ] **Sincronia Realtime não dispara**: guest/output assinam
      `postgres_changes` em `studio_rooms`, mas a tabela **não está** na
      publicação `supabase_realtime` — adicionar à publicação (ou trocar a
      via de sincronia).
- [ ] **Segurança do token**: `/api/studio/token` com `isDirector=true` só
      confere se há usuário logado, não valida `has_event_role(_,'stream')`
      — qualquer autenticado pega `roomAdmin`. Remover também o fallback
      `devkey`/`secret` hardcoded.
- [ ] Provisionar/definir o servidor LiveKit de produção (a env aponta pra
      onde?) e validar custo/escala.
- [ ] Estabilização geral de UX/mixer, gravação/VOD, e demais melhorias a
      alinhar com o Marcelo.

## Gestão administrativa e ciclo de vida do evento ✅ (21/07/2026, migrações 0024–0027)

**Exclusão** (pedido do Marcelo: "poder excluir agência/cliente/evento e
pessoas da equipe, inclusive admins"):
- [x] Excluir agência/cliente/evento (botão "Zona de risco" nas respectivas
      páginas do admin) — agência/cliente bloqueiam se ainda tiverem
      dependentes (erro amigável, sem cascata destrutiva); evento já
      cascata sozinho no banco (inscrições/chat/quiz/fotos/sorteios)
- [x] Remover pessoa da equipe de cliente/agência (`OrgTeam.tsx`) já
      permitia remover admin — faltava `confirm()` (adicionado) e proteção
      de não deixar a organização sem nenhum admin (trigger
      `enforce_last_{client,agency}_admin`, bloqueia remoção/rebaixamento)
- [x] Excluir conta de usuário de verdade (auth + profile), inclusive quem
      é admin de plataforma, só na tela `/admin/equipe` — rota
      `/api/admin/users/[id]` usa a Admin API do Supabase (service role,
      server-only) porque `auth.users` não tem RLS. `posts`/`questions`/
      `event_photos.author_id` e `events.created_by` viram `null` em vez
      de bloquear a exclusão (nome já denormalizado em `author_name`)
- [x] `/admin/equipe` filtrado pra mostrar só quem já é admin geral ou
      moderador (antes listava todo profile já criado, participante
      incluso) — buscar por nome/e-mail ainda abre pra qualquer pessoa,
      pra dar pra promover alguém novo. Equipe de cliente/agência já vive
      na página de cada um; participante de evento já vive em Inscrições
      (conferido, sem sobreposição)

**Evento encerrado / on demand:**
- [x] Banner "EVENTO ENCERRADO" explícito **dentro da área do player**
      (mesmo lugar do aviso de evento agendado, nunca uma barra solta no
      topo) quando `status = 'ended'`
- [x] Chat (input some, histórico continua, sem exceção pra quem entra
      como staff pela Sala do evento — o Diretor é outro componente),
      Q&A (form some, voto desabilita), fotos (upload some, grade
      continua) e atividades (aba Interação/overlay somem) travados
      quando o evento não está mais `'live'`
- [x] Defesa em profundidade: RPCs de escrita
      (`submit_activity_response`, `answer_question`, `submit_question`,
      `toggle_question_vote`, `submit_photo`) rejeitam se
      `events.status <> 'live'` — chat já tinha essa trava via RLS desde
      a migração 0001
- [x] Status **`'ondemand'`**: botão "Deixar on demand" no Diretor
      (só aparece depois de encerrar) — mantém o player tocando o mesmo
      `stream_ref` (vira VOD sozinho no provedor) com interação travada
      igual a `'ended'`; `get_room_event` libera a fonte do vídeo pra
      `'live'` e `'ondemand'`; badge "Disponível on demand" na vitrine

**Bugfix:** `EventForm.tsx` mostrava o horário de início em UTC como se já
fosse local (`<input type="datetime-local">` não converte fuso sozinho) —
admin via 20:20, horário real (e o que a sala já mostrava certo) era
17:20. Corrigido com `toLocalDatetimeInputValue()`.

## Pendências avulsas (encaixar entre fases)

- [ ] Google OAuth (aguarda credencial no Google Cloud do usuário)
- [ ] Upload de planilha (.txt/.csv) para allowlist — colar e-mails já atende
- [x] Revisar view `quiz_leaderboard` (roda com privilégio do owner) ✅
      (20/07/2026, migração 0022) — view rodava sem RLS própria (dono
      bypassa RLS), então qualquer autenticado lia ranking de qualquer
      evento/cliente via REST direto. Acesso direto revogado de
      anon/authenticated; `ReportView`/`ActivityManager` passam a chamar a
      RPC `get_quiz_leaderboard` (security definer, exige
      `has_event_role('quiz'|'reports')`)
- [ ] Evento-piloto completo em produção (allowlist + consentimento + artes)

---

## Concluído

**Fase 1 — MVP (jul/2026):** Next.js 16 + Supabase; eventos com player
YouTube/Vimeo/Dacast; cadastro configurável + campos personalizados + fila de
aprovação; chat realtime com moderação; quiz ao vivo com ranking; reações
flutuantes; painel Diretor; relatórios com export CSV; presença (heartbeat);
white-label por evento (cor/logo/artes); auth senha + código OTP por e-mail
(SMTP Hostinger); deploy Railway + domínio lives.propanofilmes.com.br.

**V2 multi-tenant, fases A–D (jul/2026):** agências → clientes → eventos;
equipes estilo Drive com convites por e-mail; funções por evento (5 caixas:
transmissão/chat/quiz/inscrições/relatórios); modos de cadastro
(aberto/allowlist/domínio) + aprovação + consentimento LGPD; páginas públicas
`/cliente` (agregadora com visibilidade pública/restrita/privada) e
`/cliente/evento`; artes por evento e por cliente (fundos desktop/mobile,
card, apoiadores); migrações 0001–0008.
