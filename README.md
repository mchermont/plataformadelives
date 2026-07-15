# Plataforma de Lives

Plataforma de live streaming com acesso controlado de participantes, suporte a até 1000 usuários simultâneos, feed/chat em tempo real e quiz ao vivo.

## Estrutura do repositório

```
Plataforma de lives/
├── README.md            ← este arquivo
├── docs/
│   ├── ARQUITETURA.md   ← arquitetura, stack e modelo de dados
│   └── ROADMAP.md       ← fases e escopo de cada entrega
└── web/                 ← aplicação Next.js (frontend + API)
    └── supabase/        ← migrações SQL do banco (Supabase)
```

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend / API | Next.js (App Router, TypeScript) + Tailwind CSS |
| Banco, Auth e Realtime | Supabase (Postgres, Auth com e-mail OTP e Google, Realtime) |
| Player de vídeo | Adaptadores: YouTube, Vimeo, Dacast (embed) e HLS próprio (fase 2) |
| Streaming próprio (fase 2) | Provedor sob demanda (Cloudflare Stream / Mux / AWS IVS) |
| Hospedagem | Vercel (app) + Supabase (backend) |

## Funcionalidades

### Fase 1 — MVP (em desenvolvimento)
- **Eventos**: criação e gestão de eventos de live com página própria
- **Player embed**: YouTube, Vimeo ou Dacast, configurável por evento
- **Controle de acesso configurável por evento**:
  - Cadastro simples (nome + e-mail)
  - Login com Google
  - Cadastro com aprovação manual de admin
  - Restrição por domínio de e-mail (ex.: só `@empresa.com.br`)
  - Verificação de e-mail por código (OTP) em todos os modos
  - Campos de cadastro personalizáveis por evento
- **Feed/chat em tempo real** com moderação (fixar, apagar, banir)
- **Quiz ao vivo**: admin dispara perguntas, participantes respondem, ranking em tempo real
- **Presença**: contagem de usuários online no evento

### Fase 2 — Streaming próprio
- Ingestão RTMP (OBS/vMix) via provedor sob demanda
- Entrega HLS no player da plataforma (sem marca de terceiros)
- Pagamento por minuto de vídeo entregue

### Fase 3 — Extras
- Relatório de presença e participação por evento
- Enquetes (polls) além de quiz
- White-label por cliente/evento

## Desenvolvimento

```bash
cd web
npm install
cp .env.example .env.local   # preencher com as chaves do projeto Supabase
npm run dev
```

Veja [docs/ARQUITETURA.md](docs/ARQUITETURA.md) para detalhes do modelo de dados e decisões técnicas.
