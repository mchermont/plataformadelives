# Roadmap

> Atualizado em 19/07/2026. Fases concluídas resumidas no fim do arquivo.

## Visão

Plataforma de lives white-label com gamificação: interações ao vivo estilo
Mentimeter, sorteios, galeria, materiais e moderação completa — operada por
agências/clientes num painel multi-tenant.

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

## Fase H — Sorteios

**Objetivo:** sorteios ao vivo com prova de lisura, integrados à base de
participantes.

- [ ] **Sorteio entre participantes** — fontes: inscritos aprovados, presentes
      na sala (attendance) ou lista colada/importada (.txt/planilha)
- [ ] Regras: nº de ganhadores, permitir/impedir ganhar mais de uma vez,
      exclusões (ex.: equipe)
- [ ] **Sorteio de números** — intervalo personalizado (ex.: 1–100), quantidade
      por rodada, sem repetição
- [ ] **Visuais de sorteio** — roleta giratória e cara ou coroa para dinâmicas
      rápidas; animação de revelação na tela pública
- [ ] **Auditoria** — log de cada sorteio (data/hora, semente aleatória,
      participantes elegíveis, resultado) armazenado e exportável, garantindo
      resultado matemático e não manipulado (estilo Sorteador UFSCar)
- [ ] Integração com redes sociais (comentários de Instagram/Facebook):
      **avaliar depois** — depende de APIs da Meta e revisão de permissões;
      fora do escopo próximo

## Fase I — Player white-label (YouTube sem cara de YouTube)

**Objetivo:** rodar vídeo do YouTube dentro de player próprio ocultando ao
máximo a identidade da origem.

- [ ] Wrapper com a YouTube IFrame API: `controls=0`, sem título/overlays,
      controles próprios da plataforma (play/pausa/volume/fullscreen) por cima
- [ ] Capa personalizada antes do play; overlay bloqueando cliques na logo e
      impedindo pausa-com-logo
- [ ] Mesma abordagem avaliada para Vimeo (player já é limpo com plano pago)
- ⚠️ **Limite conhecido:** os termos do YouTube não permitem remover 100% a
  marca (a logo pode aparecer em pausa/fim). O caminho definitivo para
  white-label total é a **Fase J (streaming próprio)** — este player é a
  melhor aproximação possível enquanto isso

## Fase J — Streaming próprio (sob demanda)

Sem dependência de YouTube/Vimeo — white-label de verdade. (Planejada desde o
início como "Fase 2"; decidido: provedor sob demanda, não self-hosted.)

- [ ] Escolher provedor (Cloudflare Stream vs Mux vs AWS IVS) — custo/minuto,
      latência, DVR, região Brasil
- [ ] `HlsAdapter` no player (hls.js) — slot já existe
- [ ] Painel: criar transmissão → URL RTMP + stream key para OBS/vMix
- [ ] Estado da transmissão via webhook; estimativa de custo por live
- [ ] Gravação/VOD pós-live

## Pendências avulsas (encaixar entre fases)

- [ ] Google OAuth (aguarda credencial no Google Cloud do usuário)
- [ ] Upload de planilha (.txt/.csv) para allowlist — colar e-mails já atende
- [ ] Revisar view `quiz_leaderboard` (roda com privilégio do owner)
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
