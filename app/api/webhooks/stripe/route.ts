import { type NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2026-04-22.dahlia",
      typescript: true,
    });
    event = stripeInstance.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const admin = createAdminClient();

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata.userId;
        const planKey = sub.metadata.planKey as "solo" | "agent" | undefined;
        if (!userId) break;

        const plan = planKey === "agent" ? "agent" : planKey === "solo" ? "solo" : "trial";
        const status = sub.status;

        await admin
          .from("users")
          .update({
            plan,
            subscription_status: status,
            stripe_customer_id: sub.customer as string,
            stripe_subscription_id: sub.id,
          })
          .eq("id", userId);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata.userId;
        if (!userId) break;

        await admin
          .from("users")
          .update({
            plan: "trial",
            subscription_status: "canceled",
            stripe_subscription_id: null,
          })
          .eq("id", userId);
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        // Reset monthly usage counter on successful payment
        const { data: user } = await admin
          .from("users")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .single();

        if (user) {
          await admin
            .from("users")
            .update({ listings_used_this_month: 0 })
            .eq("id", user.id);
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        const { data: user } = await admin
          .from("users")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .single();

        if (user) {
          await admin
            .from("users")
            .update({ subscription_status: "past_due" })
            .eq("id", user.id);
        }
        break;
      }

      // Checkout completed — link customer ID to user
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        if (userId && session.customer) {
          await admin
            .from("users")
            .update({ stripe_customer_id: session.customer as string })
            .eq("id", userId);
        }
        break;
      }
    }
  } catch (err) {
    console.error("Webhook handler error:", err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
