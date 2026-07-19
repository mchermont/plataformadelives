---
target: Formulário de evento (EventForm.tsx)
total_score: 21
p0_count: 1
p1_count: 2
timestamp: 2026-07-19T20-18-28Z
slug: src-components-admin-eventform-tsx
---
Method: dual-agent (A: general-purpose design review · B: Explore detector+manual)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | "Salvando…" existe, mas sem confirmação de sucesso pós-save (só navega embora) |
| 2 | Match System / Real World | 3 | Boa linguagem na maioria; "Slug", "Fonte", "Checkbox" vazam jargão técnico |
| 3 | User Control and Freedom | 2 | Allowlist grava direto no banco fora do fluxo de "Salvar"; Cancelar sem confirmação de descarte |
| 4 | Consistency and Standards | 3 | `inputClass`/`labelClass` reaproveitados; mas 3 padrões visuais diferentes para blocos condicionais |
| 5 | Error Prevention | 2 | Slug duplicado só descoberto após round-trip; campo "Rótulo" vazio é descartado silenciosamente ao salvar |
| 6 | Recognition Rather Than Recall | 3 | Valores atuais sempre visíveis; mas zero preview de branding |
| 7 | Flexibility and Efficiency | 2 | Parser de e-mail tolerante é bom; sem duplicar evento como template, sem pular seções |
| 8 | Aesthetic and Minimalist Design | 1 | Rolagem única de ~880 linhas de JSX, sem abas/acordeão para 7 seções e 11+ sub-tópicos |
| 9 | Error Recovery | 1 | `errorMessage()` só reconhece 2 casos; resto cai em erro genérico sem indicar campo |
| 10 | Help and Documentation | 2 | Hints pontuais bons (Status, LGPD); zero ajuda por provedor de streaming |
| **Total** | | **21/40** | **Acceptable** |

## Anti-Patterns Verdict

**LLM**: Não é o pior caso de slop — há headers de seção reais e hierarquia pai/filho local bem feita (indentação `ml-6` em chat→moderação e Q&A→sub-opções). O sintoma aparece no nível macro: ~7 seções e 11+ sub-tópicos despejados em scroll único, sem abas/acordeão/índice — "seções nomeadas dentro de um scroll infinito".

**Deterministic scan**: exit 0, limpo — de novo, a ferramenta não cobre associação label/input nem fluxo de erro, os achados reais vieram da leitura manual.

**Manual (Assessment B)**: **zero ocorrências de `htmlFor`/`id`/`aria-*` no arquivo inteiro** — nenhum dos ~20 campos de texto/select/textarea associa label ao input programaticamente (funciona só por proximidade visual, quebra pra leitor de tela). Único campo com indicador de obrigatório visível: "Título *" — os demais (inclusive "Rótulo" de campo personalizado, que é silenciosamente descartado se vazio ao salvar) não têm nenhuma marcação. Erro único global no topo do formulário, botão Salvar no fim — usuário não vê o erro sem rolar de volta. 3 padrões visuais diferentes para blocos condicionais convivendo sem critério. `outline-none` sem substituto visual adequado em ~20 elementos.

## Overall Impression

A tela sabe fazer hierarquia local bem (sub-opções indentadas, condicionais), mas não decidiu nenhuma estratégia para o problema real dela, que é volume: 30+ controles fixos mais campos ilimitados, um scroll único sem bússola. O achado mais sério não é visual, é funcional: o próprio formulário instrui o organizador a salvar antes de configurar a allowlist, e então o redireciona pra longe da tela onde isso seria feito.

## What's Working

- **Hierarquia pai/filho de sub-opções** (chat→moderação, Q&A→anônimas/moderação) com indentação e renderização condicional — padrão certo pro que o produto pede.
- **Consistência de baixo nível**: `inputClass`/`labelClass` centralizados garantem tratamento uniforme em todo input/checkbox/select.
- **Parsing tolerante de e-mails** na allowlist (vírgula, ponto-e-vírgula, quebra de linha misturados).

## Priority Issues

- **[P0] Fluxo de allowlist quebra a própria instrução da tela**: ao escolher modo "allowlist" num evento novo, a UI diz "salve para gerenciar a lista" — mas `save()` sempre navega embora (`router.push(backTo)`) após criar, ejetando o organizador antes dele poder fazer o que acabou de ser instruído. Fix: redirecionar para a própria edição após criar (não para a listagem). → `/impeccable harden`
- **[P1] Nenhum campo tem label associado (`htmlFor`/`id`)**: leitor de tela não liga texto ao controle em ~20 campos. Fix: adicionar `id`/`htmlFor` em todos os pares label/input. → `/impeccable audit`
- **[P1] "Cancelar" sem confirmação de descarte, destino inconsistente com "Salvar"**: `Cancelar` sempre vai pra `/admin`; `Salvar` calcula destino considerando `clientId`. Fix: mesmo destino calculado + confirm se houver mudanças. → `/impeccable clarify`
- **[P2] Erro preso no topo, Salvar no fim**: formulário de ~880 linhas, erro de slug duplicado invisível se o usuário estiver rolado até o fim. Fix: scroll automático até o erro, ou erro inline por campo. → `/impeccable clarify`
- **[P3] Placeholder de "ID/URL da transmissão" genérico**: YouTube/Vimeo/Dacast/HLS têm formatos bem diferentes, sem dica por provedor. → `/impeccable clarify`

## Persona Red Flags

**Jordan (leigo)**: não entende "Slug (URL)" na primeira leitura; escolhe allowlist, salva, é ejetado da tela exatamente quando ia configurar a lista de e-mails (P0 acima). Não distingue os dois toggles de aprovação (`require_approval` vs `allowlist_fallback_approval`) sem nenhuma explicação de como interagem. Apaga o campo "Capacidade" pra digitar de novo e vê o valor voltar sozinho pra 1000 a cada backspace.

**Riley (adversarial)**: fecha a aba no meio de 5 uploads de branding — tudo some sem aviso. Cola 50 e-mails malformados na allowlist — descartados silenciosamente sem dizer quantos. Clica "×" pra remover logo de patrocinador — alvo de ~16px, fácil de errar.

## Minor Observations

- Seletor de tipo de campo personalizado mistura idioma ("Texto", "Seleção", "Checkbox").
- Sem contador de caracteres em descrição/consentimento LGPD.
- Reordenar campos personalizados só recriando (sem drag-to-reorder).
- Upload de imagem não valida dimensão no client apesar do label sugerir tamanho específico.

## Questions to Consider

- Por que essa tela (preenchida sem pressão de tempo real) não usa abas em vez de scroll único de 880 linhas?
- O redirecionamento pós-save pra listagem foi decisão intencional ou acidente de reaproveitar o mesmo `save()` pra create/update?
- Vale pré-visualização ao vivo de cor+logo+fundo antes de salvar, já que branding é o que o cliente final mais nota?
