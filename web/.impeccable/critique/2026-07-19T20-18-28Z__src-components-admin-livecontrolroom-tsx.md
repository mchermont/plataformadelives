---
target: Painel Diretor (LiveControlRoom.tsx)
total_score: 20
p0_count: 2
p1_count: 2
timestamp: 2026-07-19T20-18-28Z
slug: src-components-admin-livecontrolroom-tsx
---
Method: dual-agent (A: general-purpose design review · B: Explore detector+manual)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Badges claros (AO VIVO, status de atividade, fila), mas abas inativas (perguntas/fotos) sem contador de pendências |
| 2 | Match System / Real World | 3 | Linguagem e metáforas batem com o domínio |
| 3 | User Control and Freedom | 2 | Sem undo para apagar mensagem ou banir — irreversível e sem aviso |
| 4 | Consistency and Standards | 2 | Ícones de abrir/fechar consistentes; mas confirmação de exclusão é inconsistente entre os 4 managers |
| 5 | Error Prevention | 1 | Banir participante: 1 clique, sem confirmação, escondido em hover, ao lado de 2 outros ícones pequenos |
| 6 | Recognition Rather Than Recall | 3 | Tooltips e modais de ajuda por tipo de atividade (`TYPE_HELP`) são um ponto forte específico do produto |
| 7 | Flexibility and Efficiency | 1 | Nenhum atalho de teclado, nenhuma ação em lote, sem filtro para esconder atividades encerradas |
| 8 | Aesthetic and Minimalist Design | 2 | Card de atividade concentra tipo+contagem+flags+7 botões num bloco denso |
| 9 | Error Recovery | 1 | Mensagens cruas do Postgres exibidas direto ao operador |
| 10 | Help and Documentation | 2 | Modais "?" por tipo de atividade são bons; nada em nível de tela inteira |
| **Total** | | **20/40** | **Acceptable** |

## Anti-Patterns Verdict

**LLM**: Emoji como ícone cobre a tela toda de novo (🎛📽🖥🎲✓✕▶■⬇🗑📌🚫↩⭐▲), consistente mas genérico. Paleta é literalmente o padrão de tutorial Tailwind dark-mode (sky/emerald/amber/red/neutral) sem referência à identidade Propano Filmes. `downloadCsv` está copiado verbatim em 3 arquivos (ActivityManager, RaffleManager, QAManager) — evidência de geração rápida sem consolidação, não é visual mas é um tell do processo.

**Deterministic scan**: exit 0, limpo — mesma ressalva: a ferramenta não cobre confirmação de ações destrutivas nem consistência entre componentes, os achados mais importantes vieram todos da checagem manual.

**Manual (Assessment B) — tabela de confirmação em ações destrutivas**:

| Ação | Confirmação? |
|---|---|
| Excluir atividade | Sim (`confirm()`) |
| Excluir sorteio | Sim (`confirm()`) |
| Excluir pergunta de quiz | Não |
| Remover resposta da fila | Não |
| Apagar pergunta de Q&A | Não |
| **Apagar foto da galeria (arquivo + banco, irreversível)** | **Não** |

Achado mais grave: apagar foto do Storage é irreversível e disparado por um ícone que só aparece no hover — risco real de exclusão acidental sem chance de desfazer.

**Padrão de "excluir" tem 4 visuais diferentes** entre os managers (botão texto puro / botão emoji+texto / link sublinhado / ícone isolado hover-only) — nenhum componente `DestructiveButton` compartilhado.

## Overall Impression

Tela operacional funcional sob as métricas certas (badges, ajuda contextual, separação sortear/exibir bem pensada), mas a segurança contra erro é aleatória: dois pontos de exclusão pedem confirmação, quatro não — incluindo o mais perigoso e irreversível (foto). Isso não parece uma decisão de produto, parece acaso de implementação.

## What's Working

- **Modelo "1 atividade aberta por vez" bem comunicado**: badges, mensagem de rodapé, botão desabilitado com `title` explicando por quê.
- **Sorteios auditáveis bem pensados**: separar "Sortear" de "Exibir" em dois passos evita revelar sem querer; CSV de auditoria documenta semente/elegíveis/método de forma verificável.
- **Ajuda contextual por tipo de atividade** (`TYPE_HELP`) — genuinamente útil para operador não-especialista.

## Priority Issues

- **[P0] Banir/apagar mensagem sem confirmação, atrás de hover**: `ChatPanel.tsx` — inacessível em touch, dispara no primeiro clique. Fix: confirmação + revelar via `:focus-within`. → `/impeccable harden`
- **[P0] Sem contador de pendências nas abas inativas**: pergunta/foto aguardando moderação pode passar despercebida por minutos. Fix: badge numérico na aba. → `/impeccable clarify`
- **[P1] Coluna central sem `max-width`**: em monitor ultrawide, formulários esticam sem controle. Fix: `max-w-2xl` nos formulários internos. → `/impeccable layout`
- **[P1] Prévia do telão pequena demais pra conferir texto no breakpoint xl** (400px de coluna, iframe escalado a 0.2). Fix: modal de ampliar, ou mais altura reservada. → `/impeccable layout`
- **[P2] Erros crus do Supabase exibidos ao operador** (`err.message` direto). Fix: mapear erros comuns pra frases pt-BR acionáveis. → `/impeccable clarify`

## Persona Red Flags

**Alex (operador experiente)**: lista de atividades mistura pendentes/abertas/fechadas sem filtro — em evento de 2h com 15 atividades, vira rolagem repetida. Depois de "Sortear", precisa lembrar de clicar "Exibir" num card separado, sem prompt de "pronto, exibir agora?". Zero atalhos de teclado em qualquer lugar.

**Sam (acessibilidade)**: botões 📌🗑🚫 do chat têm `title` mas não `aria-label` — inconsistente com outros botões do mesmo arquivo que têm; modal de ajuda não trata Esc nem foco preso/devolvido.

## Minor Observations

- `h1` usa emoji 🎛 sem `aria-hidden` — leitor de tela provavelmente anuncia "engrenagem" antes do nome do evento.
- `confirm()` nativo do navegador quebra a identidade visual custom no momento mais crítico (confirmar exclusão).
- Texto de rodapé menciona parâmetros de URL técnicos (`?bg=transparent`) solto, sem destaque/copiável.

## Questions to Consider

- Se banir e excluir sorteio são ambos irreversíveis, por que só um pede confirmação?
- A coluna "Atividades" sem limite de largura foi escolha deliberada ou sobrou espaço no grid?
- A prévia do telão em xl serve pra decidir algo, ou só confirma que carregou? Se for só isso, vale o espaço de coluna que ocupa?
