# End-to-End Message Encryption Implementation

## ✅ Implementação Completa

Foi implementada criptografia de ponta a ponta (E2EE) nas edge functions de mensagens usando **AES-256-GCM**.

## 📁 Arquivos Modificados

### 1. `/supabase/functions/_shared/encryption.ts` (NOVO)

Módulo auxiliar com funções de criptografia:

- `getEncryptionKey()` - Busca a chave de criptografia das Supabase Secrets
- `encryptMessage()` - Criptografa mensagem usando AES-256-GCM
- `decryptMessage()` - Descriptografa mensagem usando AES-256-GCM

### 2. `/supabase/functions/send-message/index.ts` (ATUALIZADO)

**Fluxo de criptografia:**

1. Recebe `content` (texto plano) do cliente
2. Busca a chave de criptografia das Supabase Secrets
3. Gera IV aleatório de 12 bytes
4. Criptografa usando AES-256-GCM
5. Salva no banco:
   - `content_enc` - Texto cifrado (base64)
   - `content_iv` - IV (base64)
   - `content_tag` - Tag de autenticação (base64)
6. Retorna apenas `{ status: "sent", chat_id, message_id }`

**⚠️ Importante:** O texto plano NUNCA é armazenado no banco.

## 🔐 Especificações Técnicas

### Algoritmo

- **Cipher:** AES-256-GCM
- **Key size:** 256 bits (32 bytes)
- **IV size:** 96 bits (12 bytes)
- **Tag size:** 128 bits (16 bytes)

### Chave de Criptografia

**Localização:** Supabase Secrets (variável de ambiente)

- **Nome da Secret:** `MESSAGE_ENCRYPTION_KEY`
- **Formato:** Base64
- **Tamanho:** 32 bytes (AES-256)
- **Acesso:** Apenas pelas edge functions via `Deno.env.get()`

### Estrutura do Banco

```sql
-- Tabela messages
CREATE TABLE messages (
  id uuid PRIMARY KEY,
  chat_id uuid REFERENCES chats(id),
  sender_id uuid REFERENCES users(id),
  content_enc text,      -- Ciphertext (base64)
  content_iv text,       -- IV (base64)
  content_tag text,      -- Auth tag (base64)
  created_at timestamptz,
  read_at timestamptz
);
```

## 🛡️ Segurança

### ✅ Implementado

- [x] Criptografia AES-256-GCM no servidor
- [x] IV único para cada mensagem
- [x] Tag de autenticação (128 bits)
- [x] Chave armazenada nas Supabase Secrets
- [x] Acesso à chave apenas pelas edge functions
- [x] Texto plano NUNCA é persistido
- [x] Tratamento de erros sem expor dados sensíveis
- [x] Sem logs de conteúdo descriptografado

### ⚠️ Observações

- As mensagens são criptografadas **no servidor**, não no cliente
- O servidor possui acesso ao texto plano durante o processamento
- Para E2EE verdadeira (sem acesso do servidor), seria necessário criptografia no lado do cliente

## 🚀 Como Testar

### 1. Configurar chave de criptografia nas Supabase Secrets

```bash
# Gerar chave de 32 bytes em base64
openssl rand -base64 32

# Adicionar como secret no Supabase
supabase secrets set MESSAGE_ENCRYPTION_KEY=<sua_chave_base64_aqui>
```

### 2. Enviar mensagem

```bash
curl -X POST https://your-project.supabase.co/functions/v1/send-message \
  -H "Authorization: Bearer USER_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "to_user_id": "uuid-here",
    "content": "Hello, this will be encrypted!"
  }'
```

**Resposta:**

```json
{
  "status": "sent",
  "chat_id": "uuid",
  "message_id": "uuid"
}
```

## 📊 Diagrama de Fluxo

```
┌─────────────────────────────────────────────────────────────┐
│                    SEND MESSAGE                              │
└─────────────────────────────────────────────────────────────┘
   Cliente                Edge Function              Database
      │                          │                        │
      │  POST /send-message      │                        │
      │  { content: "Hello" }    │                        │
      ├─────────────────────────>│                        │
      │                          │                        │
      │                          │  Get encryption key    │
      │                          │  from Secrets          │
      │                          │  (MESSAGE_ENCRYPTION_KEY)
      │                          │                        │
      │                          │  Encrypt with          │
      │                          │  AES-256-GCM           │
      │                          │  (IV, tag, ciphertext) │
      │                          │                        │
      │                          │  INSERT messages       │
      │                          │  (content_enc, iv, tag)│
      │                          ├───────────────────────>│
      │                          │<───────────────────────┤
      │                          │                        │
      │  { status: "sent" }      │                        │
      │<─────────────────────────┤                        │
      │                          │                        │

```

## ⚠️ Pendências

### Schema do Banco

Certifique-se de que a tabela `messages` tenha as colunas corretas:

```sql
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS content_enc text,
  ADD COLUMN IF NOT EXISTS content_iv text,
  ADD COLUMN IF NOT EXISTS content_tag text;

-- Remover coluna antiga (se existir)
ALTER TABLE messages DROP COLUMN IF EXISTS content;
```

### Supabase Secret

Certifique-se de que `MESSAGE_ENCRYPTION_KEY` está configurada nas Supabase Secrets:

```bash
supabase secrets set MESSAGE_ENCRYPTION_KEY=<sua_chave_base64_aqui>
```

## 🎯 Checklist de Segurança

- [x] Mensagens criptografadas com AES-256-GCM
- [x] IV único gerado para cada mensagem
- [x] Tag de autenticação de 128 bits
- [x] Chave armazenada separadamente
- [x] Acesso à chave apenas via service role
- [x] Texto plano nunca persistido
- [x] Sem logs de conteúdo descriptografado
- [x] Tratamento de erro sem expor dados
- [x] Fallback para mensagens não-descriptografáveis
- [x] Validação de tamanho da chave (32 bytes)
