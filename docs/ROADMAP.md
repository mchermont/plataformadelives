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

- [ ] Infra: tabela `activities` (evento, tipo, config JSON, status
      rascunho/aberta/fechada/exibindo) + `activity_responses`; Realtime;
      controle no painel Diretor; RLS via `has_event_role('quiz')`*
- [ ] **Nuvem de palavras** — participantes enviam palavras/frases curtas;
      termos mais citados crescem em destaque; ideal para brainstorming
- [ ] **Enquete de múltipla escolha** — votação simples sem certo/errado
      (o quiz competitivo com gabarito e placar já existe)
- [ ] **Escalas** — avaliar concordância/confiança/satisfação em escala
      deslizante (ex.: 1 a 10); resultado como média/distribuição
- [ ] **Respostas abertas** — comentários e ideias mais longos, exibidos ao
      apresentador em lista/balões (com filtro do que vai à tela pública)
- [ ] **Ranking (ordering)** — participantes ordenam itens por preferência;
      resultado agregado
- [ ] **Matrix (2 eixos)** — classificação de itens em dois eixos (fase E.2,
      depois dos tipos acima)
- [ ] **Exportação** — resultados por atividade em CSV/Excel (padrão pt-BR já
      usado nos relatórios); PDF avaliar depois
- [ ] Tela de resultado ao vivo na sala do participante (auto-destaque como no
      quiz) e/ou tela cheia para projeção

*Avaliar se atividades merecem capacidade própria (`can_activities`) ou se
ficam sob a caixa Quiz.

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
