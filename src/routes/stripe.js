import express from 'express';
import Stripe from 'stripe';
import dbManager from '../db/database.js';
import { requireAuth } from '../middleware/auth.js';
import { logger } from '../config/logger.js';

const router = express.Router();

// Inicializa Stripe com a chave secreta
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Mapeamento dos planos para os Price IDs do Stripe
const PLAN_PRICE_MAP = {
  'Start': process.env.STRIPE_PRICE_START || 'price_1SYtJAKSStnlL8p2PlwZBoAp',
  'Pro': process.env.STRIPE_PRICE_PRO || 'price_1SYtKFKSStnlL8p2DaRWgBh1',
  'Agência': process.env.STRIPE_PRICE_AGENCY || 'price_1SYtL8KSStnlL8p2h5Ku7hVL',
  'Agency': process.env.STRIPE_PRICE_AGENCY || 'price_1SYtL8KSStnlL8p2h5Ku7hVL'
};

/**
 * POST /api/stripe/create-checkout-session
 * Cria uma sessão de checkout do Stripe para assinatura
 */
router.post('/create-checkout-session', requireAuth, async (req, res) => {
  try {
    const { planName, planId } = req.body;
    const user = req.user;
    
    // Busca o Price ID do plano
    const priceId = PLAN_PRICE_MAP[planName];
    if (!priceId) {
      return res.status(400).json({ error: 'Plano não encontrado' });
    }
    
    // Verifica se o usuário já tem um customer_id no Stripe
    let customerId = user.stripe_customer_id;
    
    if (!customerId) {
      // Cria um novo customer no Stripe
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name || user.email,
        metadata: {
          userId: user.id.toString(),
          firebaseUid: user.firebase_uid || ''
        }
      });
      customerId = customer.id;
      
      // Salva o customer_id no banco
      await dbManager.updateUserStripeCustomer(user.id, customerId);
    }
    
    // Define URLs de retorno
    const baseUrl = process.env.BASE_URL || 
                   process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` :
                   'http://localhost:3000';
    
    // Cria a sessão de checkout
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1
        }
      ],
      mode: 'subscription',
      success_url: `${baseUrl}/payment-success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/plans.html?canceled=true`,
      metadata: {
        userId: user.id.toString(),
        planName: planName,
        planId: planId?.toString() || ''
      },
      subscription_data: {
        metadata: {
          userId: user.id.toString(),
          planName: planName
        }
      },
      allow_promotion_codes: true
    });
    
    logger.info(`Checkout session criada para usuário ${user.id}: ${session.id}`);
    
    res.json({ 
      success: true, 
      sessionId: session.id,
      url: session.url 
    });
    
  } catch (error) {
    logger.error(`Erro ao criar checkout session: ${error.message}`);
    res.status(500).json({ error: 'Erro ao criar sessão de pagamento' });
  }
});

/**
 * POST /api/stripe/create-portal-session
 * Cria uma sessão do portal do cliente para gerenciar assinatura
 */
router.post('/create-portal-session', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    
    if (!user.stripe_customer_id) {
      return res.status(400).json({ error: 'Usuário não possui assinatura ativa' });
    }
    
    const baseUrl = process.env.BASE_URL || 
                   process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` :
                   'http://localhost:3000';
    
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: `${baseUrl}/`
    });
    
    res.json({ success: true, url: portalSession.url });
    
  } catch (error) {
    logger.error(`Erro ao criar portal session: ${error.message}`);
    res.status(500).json({ error: 'Erro ao acessar portal de assinatura' });
  }
});

/**
 * GET /api/stripe/subscription-status
 * Retorna o status da assinatura do usuário
 */
router.get('/subscription-status', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    
    if (!user.stripe_customer_id) {
      return res.json({ 
        success: true, 
        hasSubscription: false,
        status: 'none'
      });
    }
    
    // Busca assinaturas ativas do cliente
    const subscriptions = await stripe.subscriptions.list({
      customer: user.stripe_customer_id,
      status: 'active',
      limit: 1
    });
    
    if (subscriptions.data.length === 0) {
      return res.json({ 
        success: true, 
        hasSubscription: false,
        status: 'none'
      });
    }
    
    const subscription = subscriptions.data[0];
    
    res.json({
      success: true,
      hasSubscription: true,
      status: subscription.status,
      planName: subscription.metadata.planName || 'Unknown',
      currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
      cancelAtPeriodEnd: subscription.cancel_at_period_end
    });
    
  } catch (error) {
    logger.error(`Erro ao verificar status da assinatura: ${error.message}`);
    res.status(500).json({ error: 'Erro ao verificar assinatura' });
  }
});

/**
 * POST /api/stripe/webhook
 * Webhook para receber eventos do Stripe
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  let event;
  
  try {
    if (endpointSecret) {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } else {
      // Em dev, aceita sem verificação (não recomendado em prod)
      event = JSON.parse(req.body.toString());
    }
  } catch (err) {
    logger.error(`Webhook signature verification failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  
  logger.info(`Stripe webhook received: ${event.type}`);
  
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        await handleCheckoutComplete(session);
        break;
      }
      
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        await handleSubscriptionUpdate(subscription);
        break;
      }
      
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        await handleSubscriptionDeleted(subscription);
        break;
      }
      
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        logger.info(`Pagamento recebido: Invoice ${invoice.id}`);
        break;
      }
      
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        logger.warn(`Pagamento falhou: Invoice ${invoice.id}`);
        // Aqui você pode enviar email ou notificação
        break;
      }
      
      default:
        logger.info(`Evento não tratado: ${event.type}`);
    }
    
    res.json({ received: true });
    
  } catch (error) {
    logger.error(`Erro ao processar webhook: ${error.message}`);
    res.status(500).json({ error: 'Erro ao processar evento' });
  }
});

/**
 * Processa checkout completado
 */
async function handleCheckoutComplete(session) {
  const userId = session.metadata?.userId;
  const planName = session.metadata?.planName;
  
  if (!userId) {
    logger.warn('Checkout completado sem userId nos metadados');
    return;
  }
  
  logger.info(`Checkout completado para usuário ${userId}, plano: ${planName}`);
  
  // Busca o plano pelo nome para obter os limites
  const plan = await dbManager.getPlanByName(planName);
  
  if (plan) {
    // Atualiza o plano do usuário
    await dbManager.updateUserPlan(userId, plan.id, {
      stripe_subscription_id: session.subscription,
      subscription_status: 'active'
    });
    
    logger.info(`Plano do usuário ${userId} atualizado para ${planName}`);
  }
}

/**
 * Processa atualização de assinatura
 */
async function handleSubscriptionUpdate(subscription) {
  const userId = subscription.metadata?.userId;
  
  if (!userId) {
    // Tenta encontrar usuário pelo customer_id
    const user = await dbManager.getUserByStripeCustomer(subscription.customer);
    if (!user) {
      logger.warn(`Subscription update sem usuário associado: ${subscription.id}`);
      return;
    }
  }
  
  logger.info(`Subscription ${subscription.id} atualizada: ${subscription.status}`);
  
  // Atualiza status no banco
  await dbManager.updateSubscriptionStatus(
    subscription.customer,
    subscription.id,
    subscription.status
  );
}

/**
 * Processa assinatura cancelada
 */
async function handleSubscriptionDeleted(subscription) {
  logger.info(`Subscription ${subscription.id} cancelada`);
  
  // Rebaixa o usuário para plano gratuito ou remove acesso
  await dbManager.updateSubscriptionStatus(
    subscription.customer,
    subscription.id,
    'canceled'
  );
}

export default router;
