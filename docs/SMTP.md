# SMTP próprio (Hostinger) — e-mails com volume + código de 6 dígitos

Sem SMTP próprio, o Supabase envia no máximo ~2-4 e-mails/hora e não permite
editar o template (por isso sem SMTP customizado vai um **link** em vez do
código). Com o SMTP da Hostinger configurado, os dois problemas somem —
produção manda o código de acesso por e-mail, ~150 e-mails/hora.

## Passo 1 — Criar a caixa de e-mail na Hostinger (você faz, ~5 min)

1. No painel da Hostinger → **E-mails** → crie uma caixa dedicada no domínio
   do projeto (ex.: `acesso@SEU-DOMINIO`). Não precisa ser a caixa pessoal —
   uma caixa só para envio transacional evita misturar com e-mail normal.
2. Anote o endereço completo e a senha da caixa — são as credenciais SMTP.

## Passo 2 — Configurar o SMTP no Supabase (você cola a senha)

Painel do Supabase → **Authentication → Emails → SMTP Settings** → habilite
"Enable Custom SMTP" e preencha:

| Campo | Valor |
|---|---|
| Sender email | `acesso@SEU-DOMINIO` (a caixa criada no Passo 1) |
| Sender name | Nome do remetente (ex.: `Plataforma de Lives`) |
| Host | `smtp.hostinger.com` |
| Port | `465` (SSL) |
| Username | o e-mail completo da caixa (`acesso@SEU-DOMINIO`) |
| Password | a senha da caixa de e-mail |

> A senha é a da caixa de e-mail — **cole você mesmo**, não compartilhe em chat.

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

**Authentication → Rate Limits** → aumentar "Emails sent per hour" conforme o
limite real da caixa Hostinger (produção está em ~150/h — confirme o teto do
seu plano antes de subir muito mais que isso, senão a Hostinger passa a
rejeitar envios).
