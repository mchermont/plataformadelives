# Plataforma de Lives

Plataforma white-label de lives com gamificação (quiz, enquetes, nuvem de
palavras, Q&A com upvote, sorteios auditáveis, galeria de fotos), multi-tenant
(Agência → Cliente → Evento), operada pela Propano Filmes. Suporte a ~1000
participantes simultâneos por evento (Realtime do Supabase).

## Estrutura do repositório

```
plataforma-lives/
├── README.md            ← este arquivo
├── docs/
│   ├── ARQUITETURA.md   ← arquitetura, stack e modelo de dados
│   ├── ROADMAP.md       ← fases e escopo de cada entrega (fonte da verdade)
│   ├── SETUP.md         ← configuração do zero ao primeiro evento
│   └── SMTP.md          ← SMTP próprio (Hostinger) para código de acesso
└── web/                 ← aplicação Next.js (frontend + API + migrações)
    ├── PRODUCT.md        ← personalidade de marca, princípios de design
    └── supabase/         ← migrações SQL do banco (Supabase)
```

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend / API | Next.js 16 (App Router, TypeScript) + Tailwind CSS 4 |
| Banco, Auth e Realtime | Supabase (Postgres, Auth com código OTP por e-mail + Google, Realtime) |
| Player de vídeo | Adaptadores: YouTube, Vimeo, Dacast (embed); HLS próprio planejado (Fase J) |
| Hospedagem | Railway (app) + Supabase (backend) |

## Funcionalidades

- **Multi-tenant**: Agência → Cliente → Evento, com equipes e permissões por
  evento (transmissão/chat/quiz e interações/inscrições/relatórios).
- **Eventos white-label**: player sem marca visível do provedor, identidade
  visual (cor/logo/artes) por evento e por cliente.
- **Controle de acesso configurável por evento**: cadastro simples, com
  aprovação manual, restrito por domínio de e-mail ou por lista de
  convidados; login por senha, código OTP ou Google.
- **Atividades interativas**: nuvem de palavras, enquete, quiz (em rodadas,
  com ranking), escalas, respostas abertas (com spotlight no telão),
  ordenação, matrix 2×2 — habilitáveis por evento, controladas ao vivo na
  Sala de produção, com tela dedicada pro telão (OBS/vMix).
- **Chat em tempo real** com moderação (pré-moderação opcional, fixar,
  apagar, banir).
- **Perguntas do público (Q&A)** com upvote (configurável), aprovação sempre
  obrigatória antes de aparecer para o público.
- **Galeria de fotos** dos participantes, com moderação obrigatória.
- **Materiais para download** por evento.
- **Sorteios auditáveis** (participantes ou números), com semente e
  algoritmo determinístico reproduzível externamente.
- **Relatórios** com export CSV (padrão pt-BR) de inscrições, presença e
  atividades.

Roadmap completo e estado de cada fase: [docs/ROADMAP.md](docs/ROADMAP.md).

## Desenvolvimento

```bash
cd web
npm install
cp .env.example .env.local   # preencher com as chaves do projeto Supabase
npm run dev
```

Configuração do zero: [docs/SETUP.md](docs/SETUP.md). Arquitetura e modelo
de dados: [docs/ARQUITETURA.md](docs/ARQUITETURA.md).
