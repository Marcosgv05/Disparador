# 🔒 Guia de Segurança - Vext

## Visão Geral das Proteções Implementadas

Este sistema implementa múltiplas camadas de segurança para proteger contra ataques comuns.

---

## ✅ Proteções Ativas

### 1. **Autenticação Firebase**
- Tokens JWT verificados pelo Firebase Admin SDK
- Renovação automática de tokens a cada 50 minutos
- Verificação de propriedade em todas as rotas de campanha

### 2. **Rate Limiting**
- Limite global: 100 requisições por IP a cada 15 minutos
- Limite de autenticação: 10 tentativas de login por hora
- Proteção contra ataques de força bruta

### 3. **Headers de Segurança (Helmet)**
- Content Security Policy (CSP)
- X-Content-Type-Options
- X-Frame-Options
- X-XSS-Protection
- Strict-Transport-Security (HSTS)

### 4. **CORS Configurado**
- Apenas origens permitidas podem fazer requisições
- Credenciais protegidas
- Em produção, requer configuração explícita de domínios

### 5. **Validação e Sanitização**
- Sanitização de inputs para remover caracteres maliciosos
- Validação de nomes de campanha, IDs e telefones
- Limite de tamanho para uploads (5MB) e JSON body (1MB)

### 6. **Proteção de Dados entre Usuários**
- Eventos WebSocket enviados apenas para o dono (não broadcast)
- Validação de propriedade de campanhas
- Isolamento de dados por usuário

---

## ⚠️ Configurações Obrigatórias para Produção

### Variáveis de Ambiente Críticas

```bash
# 1. SEMPRE defina NODE_ENV em produção
NODE_ENV=production

# 2. Gere secrets fortes e únicos
JWT_SECRET=<gere com: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
SESSION_SECRET=<gere com: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">

# 3. Configure CORS explicitamente
CORS_ORIGIN=https://seu-dominio.com,https://app.seu-dominio.com

# 4. Configure Firebase
FIREBASE_PROJECT_ID=seu-project-id

# 5. Configure admins
ADMIN_EMAILS=admin@seu-dominio.com
```

### Checklist de Deploy

- [ ] `NODE_ENV=production` configurado
- [ ] `SESSION_SECRET` com valor forte e único
- [ ] `CORS_ORIGIN` com apenas os domínios necessários
- [ ] `FIREBASE_PROJECT_ID` configurado
- [ ] `ADMIN_EMAILS` configurado (apenas emails confiáveis)
- [ ] HTTPS habilitado (obrigatório em produção)
- [ ] Banco de dados PostgreSQL com SSL habilitado

---

## 🚫 Vulnerabilidades Corrigidas

| Vulnerabilidade | Status | Correção |
|-----------------|--------|----------|
| Rotas sem autenticação | ✅ Corrigido | Adicionado `requireAuth` em todas as rotas sensíveis |
| Broadcast de eventos para todos usuários | ✅ Corrigido | Eventos enviados apenas para `user:{userId}` |
| Falta de headers de segurança | ✅ Corrigido | Helmet configurado |
| CORS muito permissivo | ✅ Corrigido | Removido aceite de qualquer `.onrender.com` |
| Upload sem limite | ✅ Corrigido | Limite de 5MB por arquivo |
| JSON body sem limite | ✅ Corrigido | Limite de 1MB |
| Exposição de erros em produção | ✅ Corrigido | Stack trace apenas em desenvolvimento |
| Falta de sanitização | ✅ Corrigido | Middleware de sanitização adicionado |

---

## 📋 Boas Práticas

### 1. **Nunca commite secrets**
- Use variáveis de ambiente
- Adicione `.env` ao `.gitignore`

### 2. **Mantenha dependências atualizadas**
```bash
npm audit
npm audit fix
```

### 3. **Logs de Segurança**
O sistema registra:
- Tentativas de login (sucesso/falha)
- Ações administrativas
- Erros de autenticação
- Requisições bloqueadas por CORS

### 4. **Backups**
- Configure backup automático do banco de dados
- Teste restauração regularmente

### 5. **Monitoramento**
- Configure alertas para erros 500
- Monitore tentativas de login falhas
- Acompanhe uso de rate limiting

---

## 🔑 Gerenciamento de Sessões WhatsApp

- Sessões são armazenadas de forma segura no banco de dados
- Credenciais do WhatsApp são criptografadas
- Cada sessão é vinculada a um usuário específico
- Desconexão automática limpa dados sensíveis

---

## 📞 Suporte

Se encontrar vulnerabilidades de segurança, por favor reporte de forma responsável antes de divulgar publicamente.
