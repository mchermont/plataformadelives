---
target: Sala do participante (EventRoom.tsx)
total_score: 23
p0_count: 0
p1_count: 3
timestamp: 2026-07-19T20-18-28Z
slug: src-components-event-eventroom-tsx
---
Method: dual-agent (A: general-purpose design review · B: Explore detector+manual)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Bons sinais (AO VIVO, spinner, badges de moderação), mas sem indicador de reconexão do Realtime |
| 2 | Match System / Real World | 3 | Idioma e metáforas batem; 🚫 (banir) e 🗑 (apagar) quase idênticos visualmente |
| 3 | User Control and Freedom | 2 | Troca forçada de aba ao abrir atividade; não há como abortar upload de foto |
| 4 | Consistency and Standards | 3 | Scaffold consistente entre painéis; mas ✕ serve para 4+ ações semanticamente diferentes |
| 5 | Error Prevention | 2 | Banir/apagar mensagem em 1 clique, sem confirmação |
| 6 | Recognition Rather Than Recall | 4 | "Pergunta X de Y" / preview de citação — padrão exemplar |
| 7 | Flexibility and Efficiency | 1 | Sem atalhos; reordenar só com setas ↑↓ |
| 8 | Aesthetic and Minimalist Design | 3 | Paleta contida, mas 5 abas + badges coloridos simultâneos pesam |
| 9 | Error Recovery | 2 | Mapeamento de erro frágil; fallback vaza mensagem crua do backend |
| 10 | Help and Documentation | 0 | Nenhum tooltip explicativo, zero onboarding, zero legendas |
| **Total** | | **23/40** | **Acceptable** |

## Anti-Patterns Verdict

**LLM**: Emoji como ícone cobre literalmente toda ação clicável (📌🗑🚫✕↩▲⬇📷🎬🎵🖼📄⏸▶🎲🏆🪙). Consistente (não é remendo isolado), mas renderiza diferente por SO/fonte e degrada em produção sem ninguém perceber. Layout genérico de live-streaming (vídeo à esquerda, abas à direita) sem personalidade além de `--brand`. Único pico de design real: `RaffleOverlay`.

**Deterministic scan**: `detect.mjs` — exit 0, limpo. Ferramenta cobre padrões de estética/copy (fonte genérica, gradiente, tracking), não aria-label/alt/consistência semântica — por isso a checagem manual é indispensável.

**Manual a11y (Assessment B)**: botões de moderação (📌🗑🚫) só têm `title`, sem `aria-label`; os 5 botões de reação têm `title` idêntico ("Enviar reação") em todos; fotos de participantes com `alt=""` (são conteúdo, não decoração); controles de moderação e "remover minha foto" só aparecem em `group-hover` — **inacessíveis em touch**, que é a maioria do público de uma live; texto de conteúdo em `13px` em Chat/Q&A/Materiais; inconsistência de ícone para "excluir" entre ChatPanel (🗑) e PhotoGallery (✕).

## Overall Impression

Funcional e com dois detalhes de execução genuinamente bons (paginação progressiva, UI otimista educada), mas a tela trata moderação como um recurso de desktop com mouse — em touch, exatamente o dispositivo da maioria do público, os controles de banir/apagar/remover-foto-própria simplesmente não aparecem. O maior risco de confiança não é visual, é silencioso: conteúdo rejeitado pela moderação some sem explicação para quem o enviou.

## What's Working

- **Paginação progressiva em atividades** ("Pergunta X de Y", Anterior/Próxima) — reduz carga cognitiva de verdade, consistente nos 3 tipos que usam.
- **UI otimista com reconciliação educada** — voto em Q&A atualiza antes da resposta do servidor; auto-scroll do chat só puxa quem já está no fim.
- **Transparência de moderação para o autor** — mensagem/foto pendente aparece com selo "em moderação" só para quem enviou (mas falha quando rejeitada — ver Priority Issues).

## Priority Issues

- **[P1] Rejeição silenciosa de conteúdo**: `ChatPanel.tsx` (filtro `visible`) esconde post com `deleted_at` mesmo do próprio autor; `PhotoGallery.tsx` só mostra foto própria em `pending`, some ao ser rejeitada. Quem foi barrado por moderação não sabe se ainda está em análise ou já foi apagado. Fix: manter visível pro autor com rótulo "removida pela moderação". → `/impeccable clarify`
- **[P1] Ações destrutivas de admin sem confirmação**: `moderate(post,"delete")` e `moderate(post,"ban")` em `ChatPanel.tsx` disparam no primeiro clique, ícone pequeno ao lado de outros dois. Fix: confirmação mínima para banir. → `/impeccable harden`
- **[P1] Troca forçada de aba**: `EventRoom.tsx` muda a aba ativa para "Interação" sozinho quando abre atividade, mesmo com o participante digitando no chat. Fix: usar só o ponto pulsante já existente como convite, não mover o foco. → `/impeccable clarify`
- **[P2] Controles de moderação/remoção só em hover**: inacessíveis em touch (maioria do público). Fix: revelar também via `:focus-within` ou sempre visíveis em telas pequenas. → `/impeccable adapt`
- **[P2] Barra de até 5 abas sem estratégia de overflow**: viola ≤4 opções por decisão em telas estreitas. Fix: agrupar abas menos usadas atrás de "mais". → `/impeccable layout`

## Persona Red Flags

**Jordan (leigo)**: controles de volume/mudo do player só aparecem em `group-hover` — em touch pode nunca descobrir que o vídeo tem som. Se a pergunta dele for rejeitada silenciosamente, provavelmente concluirá que o app travou.

**Casey (mobile, uma mão)**: reordenar itens em "ordering" só com toques repetidos em ↑/↓, sem arrastar — lento com o polegar. Controle de volume é um range de 96px dentro de barra que só aparece com hover/interação ambígua em touch.

**Sam (acessibilidade)**: botões de moderação com `title` mas sem `aria-label` (inconsistente com o botão de responder, que tem `aria-label` correto); fotos de usuário com `alt=""` como se fossem decorativas; indicador de foco em inputs é só troca de cor de borda 1px (WCAG 2.4.7 fraco), repetido em todo o app.

## Minor Observations

- `PresenceBadge` mantém `animate-pulse` permanente sem variante `motion-reduce:`.
- Bloqueio de menu de contexto + `DisableInspect` incomoda usuários legítimos e não impede nada de fato (F12 é reservado pelo navegador).
- `RaffleOverlay` e `ActivityOverlay` são independentes (pollings diferentes) e podem em tese abrir simultaneamente, empilhando dois modais.
- Erros não mapeados vazam mensagem crua do backend (`Não foi possível enviar (${msg})`).

## Questions to Consider

- Quando conteúdo é rejeitado pela moderação, o autor recebe algum aviso hoje, ou simplesmente some?
- A troca automática de aba foi testada com alguém no meio de digitar uma mensagem?
- Banir em 1 clique sem confirmação é intencional (velocidade em live tensa) ou lacuna não revisada?
- O emoji como ícone universal foi decisão deliberada ou atalho nunca revisitado?
