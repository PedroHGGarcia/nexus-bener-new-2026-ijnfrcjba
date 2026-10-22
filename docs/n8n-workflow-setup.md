# n8n — Fluxo de E-mail de Proposta Bener Máquinas

Este documento descreve como configurar o workflow do n8n para enviar o
e-mail de proposta comercial com um **link público** para visualização.

> ⚠️ **Importante:** o fluxo **não usa mais anexo PDF**. A proposta é
> acessada por um link público (qualquer pessoa, sem login) que abre uma
> página HTML completa e estilizada com a identidade visual Bener. Não é
> necessário baixar PDF, nem converter HTML, nem usar Gotenberg/Puppeteer.

---

## 1. Variáveis recebidas no webhook

O webhook do n8n recebe um POST com o seguinte corpo (campos principais):

| Campo                 | Descrição                                                                           |
| --------------------- | ----------------------------------------------------------------------------------- |
| `proposta_id`         | UUID da proposta                                                                    |
| `numero_proposta`     | Ex.: `PROP-2026-001-A`                                                              |
| `cliente_nome`        | Nome/razão social do cliente                                                        |
| `cliente_email`       | E-mail principal do cliente                                                         |
| `equipamento_nome`    | Nome da versão/equipamento                                                          |
| `valor_final`         | Valor final (numérico)                                                              |
| `moeda`               | `BRL`, `USD`, `EUR`                                                                 |
| `prazo_entrega`       | Texto do prazo de entrega                                                           |
| `condicoes_pagamento` | Texto das condições de pagamento                                                    |
| `link_proposta`       | URL **pública** da página da proposta (sem auth) — **campo principal**              |
| `app_link`            | URL da proposta dentro do Nexus (requer login)                                      |
| `recipients`          | Lista de destinatários                                                              |
| `email_html`          | HTML pronto com logos inline referenciados via `cid:` (`logo-nexus` e `logo-bener`) |
| `attachments`         | Array de objetos com os dois logos em base64 (`nexus-logo.png` e `bener-logo.png`)  |
| `logos`               | Objeto com `{ nexus, bener }` contendo `cid`, `filename` e `base64`                 |

> O `link_proposta` aponta para a edge function pública
> `public-proposal-pdf`, que retorna uma página HTML completa, estilizada e
> com a marca Bener, sem necessidade de autenticação. Qualquer pessoa que
> receber o e-mail pode clicar e visualizar **apenas** aquela proposta.

---

## 2. Workflow simplificado

O fluxo no n8n possui três passos simples para que os logos apareçam automaticamente no e-mail sem bloqueio do cliente de e-mail (Outlook / Webmail):

```
Webhook (recebe proposta)
  → Code (converte base64 dos logos em anexos binários do n8n)
  → Send Email (SMTP com Attachments Inline: logo-nexus, logo-bener)
```

### Node 1 — Webhook

- **Method:** `POST`
- **Path:** o caminho configurado no seu webhook n8n
- **Response:** `Immediately`

---

### Node 2 — Code Node (JavaScript para converter logos em binários inline)

Adicione um nó do tipo **Code** (linguagem: JavaScript, modo: _Run Once for Each Item_) logo após o Webhook. Ele transforma o base64 dos logos que o Nexus enviou nos anexos binários `logo-nexus` e `logo-bener`:

```javascript
const body = $input.item.json.body || $input.item.json
const nexusB64 = body.logos?.nexus?.base64 || (body.attachments && body.attachments[0]?.base64)
const benerB64 = body.logos?.bener?.base64 || (body.attachments && body.attachments[1]?.base64)

const binary = { ...$input.item.binary }

if (nexusB64) {
  binary['logo-nexus'] = {
    data: nexusB64,
    mimeType: 'image/png',
    fileName: 'nexus-logo.png',
    fileExtension: 'png',
  }
}

if (benerB64) {
  binary['logo-bener'] = {
    data: benerB64,
    mimeType: 'image/png',
    fileName: 'bener-logo.png',
    fileExtension: 'png',
  }
}

return {
  json: $input.item.json,
  binary,
}
```

---

### Node 3 — Send Email (ou SMTP)

No nó **Send Email** (SMTP) do n8n:

- **To:** `{{ $('Webhook').item.json.body.to || $json.body?.to || $json.to }}`
- **Subject:** `{{ $json.body?.subject || $json.subject || ('Nova proposta recebida — Proposta nº ' + ($json.body?.numero_proposta || $json.numero_proposta)) }}`
- **From:** `vendas@bener.com.br` (ou o remetente oficial da Bener)
- **Email Format:** `HTML`
- **HTML / Message:** Use a expressão:
  ```
  {{ $json.body?.email_html || $json.email_html }}
  ```
  _(Ou cole o template customizado de [`docs/n8n-email-template.html`](./n8n-email-template.html) que já contém as tags `<img src="cid:logo-nexus">` e `<img src="cid:logo-bener">`)_
- **Options → Add Option → Attachments (Inline):**
  Defina o valor fixo:
  ```
  logo-nexus, logo-bener
  ```
  _(O n8n associa a propriedade binária `logo-nexus` com o `<img src="cid:logo-nexus">` no HTML e `logo-bener` com `<img src="cid:logo-bener">`)_

> ⚠️ **IMPORTANTE:**
>
> 1. Salve o workflow no n8n clicando em **Save** (ou `Ctrl + S`).
> 2. Certifique-se de que a chave do workflow esteja **Active** (Verde). Alterações só têm efeito na produção após Salvar e Ativar.

O template já referencia as variáveis do n8n:

```
{{ $json.cliente_nome }}
{{ $json.numero_proposta }}
{{ $json.equipamento_nome }}
{{ $json.valor_final }}
{{ $json.link_proposta }}
{{ $json.prazo_entrega }}
{{ $json.condicoes_pagamento }}
```

O botão principal ("Visualizar Proposta") aponta para
`{{ $json.link_proposta }}` — o link público da página da proposta.

### Formatar o valor em moeda

`valor_final` chega como número. Para exibi-lo formatado, use uma expressão:

```
R$ {{ $json.valor_final.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2}) }}
```

Ou use um node **Set** antes do Send Email para criar um campo
`valor_final_formatado`.

---

## 3. Callback de confirmação de envio (`confirm-email-delivery`) — opcional

Após o node **Send Email**, você pode adicionar um node **HTTP Request**
que confirma a entrega no Bener Nexus. Isso garante que o audit log
reflita se o e-mail foi realmente enviado pelo n8n.

### Configuração do node

- **Method:** `POST`
- **URL:**
  ```
  https://ugnhnbfogxbcptprsfot.supabase.co/functions/v1/confirm-email-delivery
  ```
- **Authentication:** None (ou Header `x-callback-token` se o secret
  `N8N_CALLBACK_TOKEN` estiver configurado no Supabase).
- **Send Body:** Yes
- **Body Content (JSON):**

```json
{
  "proposta_id": "{{ $json.proposta_id }}",
  "status": "sent",
  "message": "E-mail enviado com sucesso pelo n8n.",
  "provider_message_id": "{{ $json.messageId || '' }}",
  "recipients": "{{ $json.recipients }}"
}
```

> Substitua `"status": "sent"` por `"status": "failed"` caso o envio falhe.
> O ideal é usar um node **If** após o Send Email para escolher `sent` ou
> `failed` conforme o resultado, e ramificar para o callback.

### Fluxo recomendado

```
Webhook (recebe proposta)
  → Send Email (HTML com o link no botão "Visualizar Proposta")
  → If (email enviado com sucesso?)
       ├─ true  → HTTP Request confirm-email-delivery { status: "sent" }
       └─ false → HTTP Request confirm-email-delivery { status: "failed", message: "{{ $error.message }}" }
```

---

## 4. Segurança (opcional)

Para proteger o callback contra chamadas arbitrárias, defina o secret
`N8N_CALLBACK_TOKEN` no Supabase (via painel de secrets do projeto) e envie-o
no header do node de callback:

```
x-callback-token: <valor-do-secret>
```

Quando esse secret existe, a edge function `confirm-email-delivery` exige o
header; quando não existe, o endpoint fica aberto (útil para testes iniciais).

---

## 5. Resumo das URLs

| Recurso                    | URL                                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------- |
| Webhook n8n (entrada)      | `https://bener.app.n8n.cloud/webhook/a6c860a9-1dcd-469c-addd-1b249d627dfa`            |
| Página pública da proposta | `https://ugnhnbfogxbcptprsfot.supabase.co/functions/v1/public-proposal-pdf?id=<UUID>` |
| Callback de confirmação    | `https://ugnhnbfogxbcptprsfot.supabase.co/functions/v1/confirm-email-delivery`        |
| Template de e-mail         | `docs/n8n-email-template.html`                                                        |

---

# Fluxo de E-mail de Ação Crítica — Bener Máquinas

A partir desta versão, o envio de e-mails de **ações críticas** (exclusões,
criação de versões, mudança de role de usuários) também passa pelo **n8n via
webhook**, em vez de usar o Resend diretamente. O fluxo é idêntico ao de
propostas, só muda o conteúdo e o webhook de destino.

> 📌 O destinatário é **fixo**: `pedro.garcia@bener.com.br`. A edge function
> não busca mais admins no banco — apenas envia `recipients` com esse único
> e-mail ao n8n. O remetente (`from`) é `extranet@bener.ind.br`, configurado
> diretamente no node **Send Email** do n8n (a edge function não envia nenhum
> campo `from` no payload, para não sobrescrever o valor do node).

```
Trigger notify_critical_action() (Postgres)
  → pg_net → edge function notify-critical-action-email
  → POST no webhook n8n (N8N_CRITICAL_ACTION_WEBHOOK_URL)
  → n8n envia o e-mail para cada admin em recipients
```

> ⚠️ Este webhook é **novo e diferente** do webhook de propostas. Crie um
> webhook separado no n8n e configure o secret `N8N_CRITICAL_ACTION_WEBHOOK_URL`
> no Supabase. Se esse secret não existir, a edge function tenta o fallback
> `N8N_WEBHOOK_URL` (genérico); se nenhum dos dois existir, o disparo falha e
> é registrado no `audit_logs` como `failed`.

---

## 6. Payload que o n8n recebe (ação crítica)

O webhook recebe um `POST` com o seguinte corpo JSON:

```json
{
  "titulo": "Ação Crítica Detectada",
  "mensagem": "O usuário Bianca excluiu a versão \"XP 600\"",
  "tipo": "critical_action",
  "actor_name": "Bianca",
  "table_name": "versoes",
  "action": "DELETE",
  "item_name": "XP 600",
  "recipients": ["pedro.garcia@bener.com.br"]
}
```

| Campo        | Descrição                                                                  |
| ------------ | -------------------------------------------------------------------------- |
| `titulo`     | Sempre `Ação Crítica Detectada`                                            |
| `mensagem`   | Texto amigável descrevendo a ação (ex.: quem fez o quê)                    |
| `tipo`       | Sempre `critical_action`                                                   |
| `actor_name` | Nome do usuário que executou a ação                                        |
| `table_name` | Tabela afetada (`profiles`, `versoes`, `modelos`, `marcas`, `produtos`, …) |
| `action`     | `INSERT`, `UPDATE` ou `DELETE`                                             |
| `item_name`  | Nome amigável do registro afetado (ou string vazia)                        |
| `recipients` | Lista fixa com um único destinatário: `pedro.garcia@bener.com.br`          |

---

## 7. Workflow n8n sugerido (ação crítica)

O fluxo no n8n é simples — apenas dois nodes:

```
Webhook (recebe ação crítica)
  → Send Email (para cada admin em recipients, com template HTML Bener)
```

### Node 1 — Webhook

- **Method:** `POST`
- **Path:** o caminho configurado no seu webhook n8n (crie um novo webhook)
- **Response:** `Immediately`

### Node 2 — Send Email

No node **Send Email** (ou "Email Send") do n8n:

- **To:** `{{ $json.recipients.join(', ') }}` (sempre `pedro.garcia@bener.com.br`)
- **Subject:** `[Bener] ⚠️ Ação Crítica — {{ $json.titulo }}`
- **From:** `extranet@bener.ind.br` (configurado diretamente no node; o payload da edge function não envia `from`)
- **Attachments:** nenhum
- **HTML / Message:** cole o template da seção **8** abaixo, que já referencia
  as variáveis do n8n (`{{ $json.mensagem }}`,
  `{{ $json.actor_name }}`, etc.).

### Iterar sobre os recipients (opcional)

Se preferir enviar um e-mail por admin (em vez de um único e-mail com todos
em cópia), use um node **Split In Batches** ou **Item Lists → Split Out** sobre
`{{ $json.recipients }}` antes do node **Send Email**, e use o item atual
como destinatário: `{{ $json.email }}`.

---

## 8. Template HTML do e-mail de ação crítica

Cole este HTML no campo **HTML / Message** do node **Send Email** do n8n. Ele
já referencia as variáveis recebidas no webhook:

```
{{ $json.mensagem }}
{{ $json.actor_name }}
{{ $json.action }}
{{ $json.table_name }}
{{ $json.item_name }}
{{ $json.titulo }}
```

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
  </head>
  <body style="font-family: Arial, Helvetica, sans-serif; color: #333; margin: 0; padding: 0;">
    <div style="background: #0b3c26; padding: 24px; text-align: center;">
      <span style="font-size: 28px; font-weight: 800; color: #ffffff; letter-spacing: 3px;"
        >BENER</span
      >
      <p style="color: #a7d4c0; margin: 5px 0 0 0; font-size: 13px;">Máquinas que Transformam</p>
    </div>
    <div style="padding: 24px; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #0b3c26; margin-bottom: 16px;">⚠️ {{ $json.titulo }}</h2>
      <p style="margin-bottom: 20px;">Uma ação crítica foi detectada no Nexus Bener:</p>

      <div
        style="background: #f0f7f3; border-left: 4px solid #0b3c26; padding: 16px; margin-bottom: 20px;"
      >
        <p style="margin: 0; font-size: 15px; line-height: 1.5;">{{ $json.mensagem }}</p>
      </div>

      <h3 style="color: #0b3c26; margin: 0 0 12px 0; font-size: 15px;">Detalhes da ação</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px;">
        <tr>
          <td
            style="padding: 8px 12px; background: #f0f7f3; border: 1px solid #e2e8f0; font-weight: bold; width: 35%;"
          >
            Quem fez
          </td>
          <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">{{ $json.actor_name }}</td>
        </tr>
        <tr>
          <td
            style="padding: 8px 12px; background: #f0f7f3; border: 1px solid #e2e8f0; font-weight: bold;"
          >
            O que fez
          </td>
          <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">{{ $json.action }}</td>
        </tr>
        <tr>
          <td
            style="padding: 8px 12px; background: #f0f7f3; border: 1px solid #e2e8f0; font-weight: bold;"
          >
            Tabela
          </td>
          <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">{{ $json.table_name }}</td>
        </tr>
        <tr>
          <td
            style="padding: 8px 12px; background: #f0f7f3; border: 1px solid #e2e8f0; font-weight: bold;"
          >
            Registro
          </td>
          <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">{{ $json.item_name }}</td>
        </tr>
      </table>

      <p style="font-size: 13px; color: #666;">Acesse o Nexus Bener para revisar esta ação.</p>
    </div>
    <div
      style="margin-top: 32px; border-top: 1px solid #e2e8f0; padding: 16px; text-align: center; font-size: 12px; color: #666;"
    >
      <p style="margin: 2px 0;">Rua Iracema Lucas, 450 (Antiga Rua Parsch) – Distrito Industrial</p>
      <p style="margin: 2px 0;">Vinhedo - SP - Brasil - CEP: 13280-172 - Fone: (019) 3826-7373</p>
      <p style="margin: 2px 0;">E-mail: vendas@bener.com.br - Site: www.bener.com.br</p>
    </div>
  </body>
</html>
```

---

## 9. Secret do webhook de ação crítica

No Supabase, configure o secret:

```
N8N_CRITICAL_ACTION_WEBHOOK_URL = https://bener.app.n8n.cloud/webhook/<seu-webhook-de-acao-critica>
```

Se esse secret não existir, a edge function tenta o fallback
`N8N_WEBHOOK_URL` (genérico, compartilhado). Se nenhum dos dois existir, o
disparo do webhook é pulado e o evento é registrado no `audit_logs` com
`webhook_success: false` e `status: failed`.

---

## 10. Idempotência

A edge function `notify-critical-action-email` mantém idempotência similar à
`send-proposal-email`: se um disparo com sucesso para a mesma ação crítica
(mesma `mensagem` + `actor_name` + `table_name` + `action` + `item_name`) já
foi registrado no `audit_logs` nos últimos **2 minutos**, o webhook n8n **não
é chamado novamente** e a função retorna `skipped: true`.
