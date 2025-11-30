# Configuração do Stripe para Pagamentos

Este documento explica como configurar o Stripe para receber pagamentos pelos planos.

## 1. Pré-requisitos

- Conta no [Stripe](https://dashboard.stripe.com/register)
- Produtos e Preços já criados no Stripe (já feito!)

## 2. Seus Produtos no Stripe

Você já tem os seguintes produtos configurados:

| Plano | Product ID | Price ID |
|-------|-----------|----------|
| **Start** | prod_TVv9EOM8uvDIcm | price_1SYtJAKSStnlL8p2PlwZBoAp |
| **Pro** | prod_TVvAOZx7ZVsYIL | price_1SYtKFKSStnlL8p2DaRWgBh1 |
| **Agência** | prod_TVvBznUqgJm8eg | price_1SYtL8KSStnlL8p2h5Ku7hVL |

## 3. Configurar Variáveis de Ambiente

### No Railway (Produção)

Vá em **Variables** no seu projeto Railway e adicione:

```
STRIPE_SECRET_KEY=sk_live_...  (ou sk_test_... para testes)
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Localmente (.env)

Crie um arquivo `.env` na raiz do projeto:

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

## 4. Obter as Chaves

### Chave Secreta (STRIPE_SECRET_KEY)

1. Acesse [Stripe Dashboard → API Keys](https://dashboard.stripe.com/apikeys)
2. Copie a **Secret key** (começa com `sk_test_` ou `sk_live_`)
3. ⚠️ **NUNCA compartilhe ou exponha essa chave!**

### Webhook Secret (STRIPE_WEBHOOK_SECRET)

1. Acesse [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks)
2. Clique em **Add endpoint**
3. Configure:
   - **URL**: `https://seu-app.railway.app/api/stripe/webhook`
   - **Eventos**: Selecione:
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`
4. Após criar, clique no webhook e copie o **Signing secret** (começa com `whsec_`)

## 5. Testar Localmente

Para testar webhooks localmente, use o [Stripe CLI](https://stripe.com/docs/stripe-cli):

```bash
# Instale o Stripe CLI
# Windows: winget install Stripe.StripeCLI
# Mac: brew install stripe/stripe-cli/stripe

# Faça login
stripe login

# Encaminhe webhooks para seu servidor local
stripe listen --forward-to localhost:3000/api/stripe/webhook

# O CLI mostrará um webhook secret temporário para usar em dev
```

## 6. Fluxo de Pagamento

```
1. Usuário escolhe plano → /plans.html
2. Se não logado → Redireciona para registro
3. Após registro → Cria checkout session → Redireciona para Stripe
4. Usuário paga no Stripe
5. Stripe redireciona para /payment-success.html
6. Webhook atualiza status no banco de dados
```

## 7. Endpoints da API

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/stripe/create-checkout-session` | Cria sessão de checkout |
| POST | `/api/stripe/create-portal-session` | Acessa portal do cliente |
| GET | `/api/stripe/subscription-status` | Verifica status da assinatura |
| POST | `/api/stripe/webhook` | Recebe eventos do Stripe |

## 8. Portal do Cliente

Para permitir que usuários gerenciem suas assinaturas:

1. Acesse [Stripe Dashboard → Settings → Billing → Customer portal](https://dashboard.stripe.com/settings/billing/portal)
2. Configure as opções desejadas (cancelar, trocar plano, etc.)
3. Salve as configurações

## 9. Modo Teste vs Produção

- **Teste**: Use chaves que começam com `sk_test_` e `pk_test_`
- **Produção**: Use chaves que começam com `sk_live_` e `pk_live_`

### Cartões de Teste

Para testar pagamentos, use:
- **Sucesso**: `4242 4242 4242 4242`
- **Recusado**: `4000 0000 0000 0002`
- **Requer autenticação**: `4000 0025 0000 3155`

Qualquer data futura e CVC de 3 dígitos funciona.

## 10. Troubleshooting

### Erro "No such price"
- Verifique se os Price IDs estão corretos
- Confirme se está usando o ambiente certo (test/live)

### Webhook não recebido
- Verifique se a URL está correta
- Confirme se o endpoint está acessível publicamente
- Verifique os logs no Stripe Dashboard

### Erro de assinatura do webhook
- Verifique se o `STRIPE_WEBHOOK_SECRET` está correto
- Em dev, use o secret temporário do Stripe CLI
