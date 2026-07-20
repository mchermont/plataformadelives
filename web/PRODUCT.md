# Product

## Register

product

## Users

- **Organizadores de evento** (equipe de agência/cliente), configurando um
  evento no admin antes da live — sem pressão de tempo real, mas muitas
  vezes não-técnicos; precisam entender o que cada opção faz sem jargão.
- **Staff/moderadores** operando o painel Diretor durante a transmissão ao
  vivo — sob pressão de tempo real, precisam achar o controle certo rápido
  (abrir atividade, sortear, moderar chat/fotos) sem escanear a tela toda.
- **Público geral** (participantes) na sala do evento — podem ser leigos,
  majoritariamente em celular, zero tolerância a fricção; é a superfície de
  maior volume e menor paciência da plataforma.

As páginas públicas de cliente/evento (o que o público vê antes de entrar)
pesam mais como "vitrine" do que o resto do produto — funcionam como a
primeira impressão da marca do cliente final, não só como formulário de
acesso.

## Product Purpose

Plataforma white-label de lives com gamificação (quiz, enquetes, nuvem de
palavras, Q&A com upvote, sorteios auditáveis, galeria de fotos) operada por
agências/clientes num modelo multi-tenant. O produto entrega dois momentos
distintos: a configuração (admin, sem pressão) e a operação ao vivo (painel
Diretor + sala do participante, ambos em tempo real). Sucesso = organizador
configura um evento sem precisar perguntar a alguém, staff modera sem
hesitar sob pressão, e participante interage sem esforço perceptível.

## Brand Personality

Profissional, confiável, discreto. A identidade visual da própria
plataforma deve ceder lugar à marca do cliente final nas telas públicas —
o white-label é o produto, não um acabamento por cima de uma marca própria
forte. Tom sério o bastante para eventos corporativos, mas a gamificação
(quiz, sorteios) pode respirar um pouco de energia nos momentos de
interação — sem nunca parecer infantil.

## Anti-references

- **"Dashboard de tutorial" genérico** — paleta sky/emerald/amber padrão do
  Tailwind sem nenhuma identidade própria (apontado explicitamente na
  crítica anterior). Referência do que evitar, não do que construir.
- **Visual infantil/lúdico demais** — mesmo com gamificação como
  diferencial, o público inclui eventos corporativos sérios.

## Design Principles

- **Servir a tarefa, não impressionar.** Cada tela é usada durante uma
  tarefa com prazo real (configurar evento, moderar ao vivo, participar de
  uma live) — nunca sacrificar clareza por estética.
- **Discrição de marca.** A identidade visual da plataforma cede lugar à
  marca do cliente final nas telas públicas; branding próprio forte é
  contrário ao produto.
- **Uma decisão de cada vez.** Sob pressão real-time (Diretor) ou diante de
  público leigo (sala), nunca mais de ~4 opções/controles competindo por
  atenção simultaneamente.
- **Consistência antes de personalidade.** O mesmo tipo de ação (excluir,
  aprovar, fechar, moderar) deve parecer e se comportar igual em qualquer
  tela — inconsistência descoberta na crítica anterior é dívida a resolver,
  não característica a preservar.
- **Acessível por padrão, não por exceção.** Clientes corporativos podem
  exigir compliance formal — contraste, foco visível e navegação por
  teclado são requisito, não best-effort.

## Accessibility & Inclusion

WCAG AA como piso, tratado como requisito contratual potencial (clientes
corporativos podem exigir compliance formal), não apenas boa prática.
Contraste ≥4.5:1 em texto de corpo, foco visível em todo controle
interativo, navegação por teclado completa nos fluxos primários, alvos de
toque adequados (a maioria do público participante está em celular).
