# Roadmap

> Atualizado em 18/07/2026. Fases concluídas resumidas no fim do arquivo.

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

### E.2 — Demais tipos
- [ ] **Escalas** (slider 1–N por afirmação; média + distribuição)
- [ ] **Respostas abertas** (balões/cartões; diretor destaca no telão;
      fila de moderação prévia)
- [ ] **Ranking (ordering)** (ordenar itens; resultado por posição média)

### E.3 — Avançado
- [ ] **Matrix 2×2** (itens posicionados em dois eixos; média ponderada)
- [ ] Refinamentos do telão (temas, chroma key, animações de entrada)

## Fase F — Q&A com upvote

**Objetivo:** perguntas do público com votação, o recurso mais pedido em
eventos corporativos.

- [ ] Envio de pergunta com identificação **ou anônima** (config por evento:
      permitir anônimas sim/não)
- [ ] Upvote nas perguntas dos outros; ordenação por votos
- [ ] Moderação: fila de aprovação opcional antes de aparecer para todos;
      marcar como respondida; apagar
- [ ] Painel do apresentador no Diretor (ordenar por votos/recentes)
- [ ] Export CSV

## Fase G — Moderação e mídia

**Objetivo:** controle editorial total do que aparece na live + conteúdo de
apoio.

- [ ] **Chat pré-moderado** — opção por evento ("chat com moderação: sim/não").
      Com moderação ativa, mensagem só publica após aprovação (fila no Diretor).
      Independente do modo, colaboradores habilitados sempre podem apagar
      mensagem e banir usuário (já existe hoje)
- [ ] **Galeria de fotos dos participantes** — envio de foto pelos
      participantes; **moderação obrigatória** (nada aparece sem aprovação);
      galeria visível na sala durante a live; limites de tamanho/formato;
      bucket próprio no Storage
- [ ] **Materiais do evento** — organizador disponibiliza arquivos para
      download (PPT, PDF, vídeo, imagem, áudio); aba/box na sala; controle de
      quais materiais estão visíveis e quando

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
