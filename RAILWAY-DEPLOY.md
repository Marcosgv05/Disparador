# Deploy no Railway - Guia Completo

## Pré-requisitos

1. Conta no [Railway](https://railway.app)
2. Projeto Firebase configurado com Authentication habilitado
3. Repositório Git (GitHub, GitLab ou Bitbucket)

## Passo 1: Criar Projeto no Railway

1. Acesse [railway.app](https://railway.app) e faça login
2. Clique em **"New Project"**
3. Selecione **"Deploy from GitHub repo"**
4. Conecte seu repositório

## Passo 2: Adicionar PostgreSQL

1. No projeto, clique em **"+ New"**
2. Selecione **"Database" → "Add PostgreSQL"**
3. O Railway criará automaticamente a variável `DATABASE_URL`

## Passo 3: Configurar Variáveis de Ambiente

Vá em **Variables** no seu serviço e adicione:

### Obrigatórias

| Variável | Valor | Descrição |
|----------|-------|-----------|
| `NODE_ENV` | `production` | Ambiente de produção |
| `FIREBASE_PROJECT_ID` | `seu-projeto-id` | ID do projeto Firebase |
| `JWT_SECRET` | `gerar-string-aleatoria` | Secret para tokens JWT |
| `SESSION_SECRET` | `gerar-string-aleatoria` | Secret para sessões |
| `ADMIN_EMAILS` | `seu@email.com` | Emails dos administradores |
| `CORS_ORIGIN` | `https://seu-app.railway.app` | URL do seu app |

### Gerar Secrets Seguros

Execute no terminal para gerar strings seguras:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Configurar Firebase Admin (Opcional mas Recomendado)

Para validação completa de tokens Firebase em produção:

1. No Firebase Console, vá em **Project Settings → Service Accounts**
2. Clique em **"Generate new private key"**
3. No Railway, crie a variável `FIREBASE_ADMIN_CREDENTIALS` com o conteúdo JSON do arquivo (em uma linha)

## Passo 4: Configurar Domínio

1. Vá em **Settings → Domains**
2. Clique em **"Generate Domain"** para um domínio `.railway.app`
3. Ou configure um domínio personalizado

## Passo 5: Deploy

O Railway faz deploy automático a cada push no repositório.

Para deploy manual:
1. Vá em **Deployments**
2. Clique em **"Deploy"**

## Variáveis Automáticas do Railway

O Railway configura automaticamente:

- `PORT` - Porta do servidor
- `DATABASE_URL` - URL do PostgreSQL (se adicionado)
- `RAILWAY_ENVIRONMENT` - Ambiente atual

## Arquitetura em Produção

```
┌─────────────────────────────────────────────────┐
│                   Railway                        │
├─────────────────────────────────────────────────┤
│  ┌─────────────┐      ┌─────────────────────┐  │
│  │   Node.js   │ ───► │    PostgreSQL       │  │
│  │   (Vext)    │      │  - Usuários         │  │
│  │             │      │  - Sessões WhatsApp │  │
│  └─────────────┘      │  - Instâncias       │  │
│                       └─────────────────────┘  │
└─────────────────────────────────────────────────┘
```

## Dados Persistidos no PostgreSQL

- ✅ Usuários e autenticação
- ✅ Sessões WhatsApp (QR codes salvos)
- ✅ Instâncias de WhatsApp
- ✅ **Campanhas** (contacts, messages, stats)
- ✅ Logs de atividade
- ✅ Planos e configurações

## Dados Temporários (Efêmeros)

> ⚠️ Estes dados são perdidos em cada deploy:

- Uploads temporários de planilhas
- Arquivos de cache

**Nota**: Em desenvolvimento local, campanhas e instâncias são salvas em arquivos JSON para facilitar debug.

## Monitoramento

1. Vá em **Observability** para ver logs em tempo real
2. Configure alertas em **Settings → Alerts**

## Troubleshooting

### Erro de Conexão PostgreSQL

Verifique se `DATABASE_URL` está configurada corretamente.

### Erro de Firebase

Verifique se `FIREBASE_PROJECT_ID` está correto.

### WhatsApp não conecta

As sessões são restauradas automaticamente do PostgreSQL. Se houver problemas:
1. Verifique os logs
2. Delete a sessão antiga e reconecte

## Custos Estimados

- **Hobby Plan**: $5/mês (inclui 512MB RAM, PostgreSQL básico)
- **Pro Plan**: A partir de $20/mês (mais recursos)

## Checklist Final

- [ ] PostgreSQL adicionado
- [ ] `NODE_ENV=production` configurado
- [ ] `FIREBASE_PROJECT_ID` configurado
- [ ] `JWT_SECRET` e `SESSION_SECRET` gerados
- [ ] `ADMIN_EMAILS` configurado
- [ ] `CORS_ORIGIN` configurado com URL do Railway
- [ ] Domínio configurado
- [ ] Deploy realizado com sucesso
- [ ] Login testado
- [ ] WhatsApp conectado e sessão persistida
