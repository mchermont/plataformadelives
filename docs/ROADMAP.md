# Roadmap

## Fase 1 — MVP (embed) ✦ em desenvolvimento

**Objetivo:** realizar uma live real com participantes controlados, chat e quiz,
usando YouTube/Vimeo/Dacast como fonte de vídeo.

1. **Fundação**
   - [x] Scaffold Next.js + Tailwind
   - [ ] Projeto Supabase + migrações (schema completo)
   - [ ] Auth: e-mail OTP (código) + Google OAuth
2. **Eventos e acesso**
   - [ ] CRUD de eventos no painel admin
   - [ ] Configuração de acesso por evento (open / approval / domain)
   - [ ] Campos de cadastro personalizáveis + formulário dinâmico
   - [ ] Fila de aprovação de participantes
3. **Página do evento**
   - [ ] Player com adaptadores YouTube / Vimeo / Dacast
   - [ ] Feed/chat em tempo real + moderação (fixar, apagar, banir)
   - [ ] Contador de presença (online agora)
4. **Quiz**
   - [ ] Editor de quiz no admin
   - [ ] Disparo de pergunta ao vivo, cronômetro, resposta dos participantes
   - [ ] Ranking em tempo real
5. **Fechamento**
   - [ ] Deploy (Vercel + Supabase) e teste de carga básico

## Fase 2 — Streaming próprio (sob demanda)

**Objetivo:** transmitir sem depender de YouTube/Vimeo/Dacast, pagando por uso.

- [ ] Escolher provedor (Cloudflare Stream vs Mux vs AWS IVS) — critérios:
      custo/minuto, latência, DVR, região Brasil
- [ ] `HlsAdapter` no player (hls.js) — o slot já existe desde a fase 1
- [ ] Painel: criar transmissão → gerar URL RTMP + stream key para OBS/vMix
- [ ] Estado da transmissão (aguardando sinal / ao vivo / encerrada) via webhook
- [ ] Estimativa de custo por live no painel (espectadores × duração)

**Referência de custo (1000 espectadores, live de 2h):**
| Provedor | Modelo | Estimativa |
|---|---|---|
| Cloudflare Stream | US$ 1 / 1.000 min entregues | ~US$ 120 |
| Mux | por minuto codificado + entregue | ~US$ 150–250 |
| AWS IVS | por hora de entrada + saída | ~US$ 200+ |

## Fase 3 — Extras

- [ ] Relatório de presença/participação (CSV) por evento
- [ ] Enquetes (polls) além do quiz
- [ ] Papéis por evento (organizador, moderador) — hoje admin é global
- [ ] White-label: logo/cores por evento ou cliente
- [ ] Gravação/VOD pós-live
