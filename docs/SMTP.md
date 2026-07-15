# SMTP próprio (Resend) — e-mails com volume + código de 6 dígitos

Sem SMTP próprio, o Supabase envia no máximo ~2-4 e-mails/hora e não permite
editar o template (por isso hoje vai um **link** em vez do código). Com o
Resend configurado, os dois problemas somem.

## Passo 1 — Criar a conta no Resend (você faz, ~5 min)

1. Acesse [resend.com](https://resend.com) e crie uma conta (grátis: 3.000
   e-mails/mês, 100/dia).
2. **Domains → Add domain**: adicione um domínio/subdomínio seu (ex.:
   `lives.bandorama.com.br`). O Resend mostra 3 registros DNS (SPF/DKIM) para
   criar no seu provedor de DNS. Sem domínio verificado, o Resend só envia
   para o seu próprio e-mail (modo teste).
3. **API Keys → Create API key** (permissão "Sending access"). Guarde a chave
   (`re_...`) — ela aparece uma única vez.

## Passo 2 — Configurar o SMTP no Supabase (você cola a chave)

Painel do Supabase → **Authentication → Emails → SMTP Settings** → habilite
"Enable Custom SMTP" e preencha:

| Campo | Valor |
|---|---|
| Sender email | `acesso@SEU-DOMINIO` (o domínio verificado no Resend) |
| Sender name | Nome do remetente (ex.: `Plataforma de Lives`) |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | a API key `re_...` |

> A senha é a API key do Resend — **cole você mesmo**, não compartilhe em chat.

## Passo 3 — Trocar o template para código (posso fazer)

Com o SMTP ativo, o template fica editável. Em **Authentication → Emails →
Templates → Magic link or OTP**, trocar o corpo para algo como:

```html
<h2>Seu código de acesso</h2>
<p>Use o código abaixo para entrar. Ele expira em 1 hora.</p>
<p style="font-size:32px;font-weight:bold;letter-spacing:8px">{{ .Token }}</p>
<p>Ou, se preferir, <a href="{{ .ConfirmationURL }}">clique aqui para entrar</a>.</p>
```

O app já aceita os dois caminhos (código **e** link) — nada muda no código.

## Passo 4 — Ajustar rate limits

**Authentication → Rate Limits** → aumentar "Emails sent per hour" (ex.: 200+
para eventos com muitos participantes chegando ao mesmo tempo).
