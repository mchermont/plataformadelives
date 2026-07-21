# Design System — Plataforma de Lives (MASTER)

Fonte de verdade para decisões de UI/UX no app inteiro. Gerado a partir do
sistema onix já implementado e revisado (`/impeccable shape`, 19/07/2026),
documentado aqui no formato da skill `ui-ux-pro-max` para auditoria e
retrieval entre sessões. Overrides por tela ficam em `design-system/pages/`.

> Não editar cores/tipografia aqui sem revisar `web/src/app/globals.css` —
> este arquivo documenta o que já existe, não prescreve algo novo.

## Estilo

**Onix monocromático** (não é "dark mode" genérico — é ausência deliberada
de matiz própria da plataforma). Toda cor saturada real é do cliente
(`--brand`, por evento) ou do cliente-agência (badge "Agência" = violeta
frio, categórico, não é marca). Regra: Propano nunca compete visualmente
com a marca do cliente.

- Tema claro existe só em `[clientSlug]/page.tsx` (vitrine pública, escolha
  de evento) — usa `bg-white`/`text-neutral-900`/`border-neutral-200` +
  `--brand` do cliente. Fora disso (login, sala, Diretor, telão, admin) é
  onix. Decisão revisada na Fase C — não misturar.

## Cores (tokens reais, `globals.css`)

| Token | Valor OKLCH | Uso |
|---|---|---|
| `--bg` | `oklch(0.07 0 0)` | fundo base |
| `--surface` | `oklch(0.14 0 0)` | cards/painéis |
| `--border-c` | `oklch(0.24 0 0)` | bordas |
| `--ink` | `oklch(0.96 0 0)` | texto principal |
| `--muted` | `oklch(0.68 0 0)` | texto secundário |
| `--accent` | `oklch(0.55 0.03 68)` | "sussurro" de calor — diferencia clicável de estático, não é cor de marca |

Overrides centrais do Tailwind (qualquer `neutral-800/900/950`,
`sky-300..950`, `purple-300/500` já nasce onix — não trocar por token
custom, ver CLAUDE.md):

- `neutral-950/900/800` → recolorido pra onix verdadeiro.
- `sky-*` → mesmo grafite quente do `--accent` (hue 68), usado como
  "cor de marca" genérica em botão/link/foco/checkbox.
- `purple-300/500` → violeta frio (hue 290), só pro badge "Agência",
  categórico — não confundir com cor de marca de cliente.
- `--brand` (por evento/cliente) → único lugar onde cor saturada própria
  do produto aparece de fato; carrega CTA/foco/hover na vitrine **e também**
  em todo o app onix (sala, Q&A, atividades, telão, `EntrarFlow`) — não é
  exclusivo da vitrine, é o acento de marca usado onde quer que o cliente
  precise aparecer.

Contraste: `--ink` sobre `--bg`/`--surface` está em L 0.96 vs 0.07/0.14 —
folga grande, mas **nunca validado numericamente contra WCAG** nesta
auditoria (só estimado por L do OKLCH). `--muted` (L 0.68) sobre `--surface`
(L 0.14) também não foi medido — candidato a checar se representa texto
secundário de leitura longa (Q&A, listas) ou só labels curtos.

## Tipografia

- Sans: **Archivo** (`--font-archivo`, `next/font/google`, variável CSS).
- Mono: **Spline Sans Mono** (`--font-spline-mono`) — usado onde (placar,
  código OTP, timer)? Não mapeado nesta auditoria — checar ao revisar
  cada tela.
- Sem escala tipográfica formal documentada (tamanhos parecem ad hoc via
  classes Tailwind padrão `text-sm/base/lg/xl` etc.) — não fabricar uma
  escala aqui; registrar como pendência de auditoria.

## Espaçamento / raio / sombra

Nenhum token custom de `radius` ou `shadow` em `globals.css`. Auditoria
20/07-21/07/2026 (leitura real de todas as telas) encontrou:

- **Raio**: telas de entrada (login, senha/nova, EntrarFlow, vitrine) têm
  escala 100% consistente — `rounded-lg` controles / `rounded-2xl` cards /
  `rounded-full` pills. Admin (clientes/agências/Diretor) já diverge:
  modais `rounded-2xl`, cards de listagem `rounded-xl`, botões de
  moderação (QAManager/GalleryManager/ChatPanel) `rounded` (4px) mas o
  equivalente em ActivityManager usa `rounded-lg` (8px) — não é uma
  escala única no admin.
- **Micro-escala tipográfica de fato (não documentada até agora)**: nos
  componentes de moderação do Diretor (`ChatPanel.tsx`, `QAManager.tsx`,
  `GalleryManager.tsx`) o padrão real é `text-[13px]` pra conteúdo de
  lista densa (mensagem/pergunta/legenda) e `text-[11px]` pra metadado
  (nome, hora, contagem) — aplicado de forma idêntica nos três arquivos.
  Vale adotar oficialmente em vez de tratar como valor arbitrário solto.
- **Borda de input mais clara que borda de card**: formulários do admin
  usam `border-neutral-700` (cinza puro do Tailwind, não recolorido) nos
  campos, enquanto cards/tabelas ao redor usam `border-neutral-800`
  (`oklch 0.22`, onix) — quebra o degradê de contraste do sistema em todo
  formulário do admin (`NewClientButton`, `NewAgencyButton`, `ClientForm`,
  `OrgTeam`, `TeamList`, `EventForm`).
- **4 idiomas visuais diferentes pra "seleção ativa"** entre
  abas/seletores do admin (preenchimento sólido `bg-sky-600`, sublinhado
  `border-b-2 border-sky-500`, borda+fundo tintado, preenchimento neutro
  `bg-neutral-800`) — nenhum errado isolado, mas sem padrão único.
- **`--brand` com fallback hex fora do onix**: `ChatPanel.tsx` usa
  `bg-[var(--brand,#0284c7)]` — quando renderizado dentro do
  `LiveControlRoom` (Diretor), `--brand` não existe na árvore (só é
  definido em componentes da Sala/vitrine/telão), então cai no fallback
  literal `#0284c7`, um azul saturado que não passa pela recoloração onix
  do Tailwind. É a única cor saturada de verdade encontrada no painel do
  operador — contradiz a regra "tudo onix fora da vitrine".

## Ícones

`lucide-react` no chrome de interface inteiro (botões, badges, categorias,
paginação, check/x/fechar) — convenção já fixada no CLAUDE.md, não a da
skill (Phosphor). Emoji só em celebração de verdade: `Reactions.tsx`,
revelação de sorteio, medalhas do ranking. `●` do badge "AO VIVO" é glyph
de status, não ícone.

## Anti-padrões a evitar (herdados da skill + já resolvidos no projeto)

- Emoji como ícone estrutural — já proibido pelo CLAUDE.md, manter.
- Vazamento de `stream_ref` em HTML/Realtime bruto — já corrigido via
  `get_room_event`, não regressar.
- Ações destrutivas sem confirmação — padrão `confirm()` já consolidado
  (revisão 19/07/2026); qualquer exclusão nova segue o mesmo padrão.
- Erros técnicos crus do Supabase/Postgres na UI — já filtrado por
  `friendlyError.ts`, não regressar.
- Scroll horizontal geral — já mitigado (`overflow-x: clip` em
  `html, body`), mas não elimina scroll horizontal *local* em containers
  específicos (checar por tela).

## Escopo desta auditoria

Esta é a base para a auditoria tela-a-tela que segue (ver relatório de
findings). Este MASTER documenta o que existe — não é uma reformulação de
design system do zero, já que o produto já passou por revisão de UX/UI
completa (`/impeccable critique` + `/impeccable shape`, ver ROADMAP).
