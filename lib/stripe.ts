import Stripe from "stripe";

function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2026-04-22.dahlia",
    typescript: true,
  });
}

export const PLANS = {
  solo: {
    name: "Solo",
    priceId: process.env.STRIPE_SOLO_PRICE_ID || "",
    price: 29,
    listingsPerMonth: 3,
  },
  agent: {
    name: "Agent",
    priceId: process.env.STRIPE_AGENT_PRICE_ID || "",
    price: 79,
    listingsPerMonth: 10,
  },
} as const;

export async function createCheckoutSession({
  userId,
  userEmail,
  planKey,
  successUrl,
  cancelUrl,
}: {
  userId: string;
  userEmail: string;
  planKey: "solo" | "agent";
  successUrl: string;
  cancelUrl: string;
}) {
  const stripe = getStripe();
  const plan = PLANS[planKey];

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    customer_email: userEmail,
    line_items: [{ price: plan.priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { userId, planKey },
    subscription_data: { metadata: { userId, planKey } },
  });

  return session;
}

export async function createPortalSession({
  stripeCustomerId,
  returnUrl,
}: {
  stripeCustomerId: string;
  returnUrl: string;
}) {
  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: returnUrl,
  });
  return session;
}
