import { Resend } from "resend";

export const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = "ListingOS <noreply@listingos.com>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://listingos.com";

export async function sendWelcome({ to, name }: { to: string; name: string }) {
  return resend.emails.send({
    from: FROM,
    to,
    subject: "Welcome to ListingOS — your free video is waiting",
    html: `
      <h1>Welcome to ListingOS, ${name}!</h1>
      <p>You're on the <strong>free trial</strong> — create your first AI listing video in under 2 minutes.</p>
      <p><a href="${APP_URL}/dashboard/new" style="background:#1A2E4A;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block">Create My First Video →</a></p>
      <p style="margin-top:32px;color:#666;font-size:14px">
        Your trial includes 1 free video. Upgrade anytime to unlock 3–10 videos/month with your full brand kit.
      </p>
    `,
  });
}

export async function sendVideoReady({
  to,
  agentName,
  address,
  listingId,
  slug,
}: {
  to: string;
  agentName: string;
  address: string;
  listingId: string;
  slug: string;
}) {
  return resend.emails.send({
    from: FROM,
    to,
    subject: `Your video for ${address} is ready!`,
    html: `
      <h1>Your video is ready 🎬</h1>
      <p>Hi ${agentName},</p>
      <p>Your cinematic listing video for <strong>${address}</strong> has been generated.</p>
      <div style="margin:24px 0">
        <a href="${APP_URL}/dashboard/listings/${listingId}" style="background:#1A2E4A;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin-right:12px">
          View &amp; Download
        </a>
        <a href="${APP_URL}/l/${slug}" style="background:#f3f4f6;color:#1A2E4A;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block">
          Share Page
        </a>
      </div>
      <p style="color:#666;font-size:14px">Both 16:9 and 9:16 formats are available for download.</p>
    `,
  });
}

export async function sendTrialEnding({ to, name, daysLeft }: { to: string; name: string; daysLeft: number }) {
  const isLastDay = daysLeft <= 1;
  return resend.emails.send({
    from: FROM,
    to,
    subject: isLastDay
      ? "Last day of your ListingOS trial"
      : `Your ListingOS trial ends in ${daysLeft} days`,
    html: `
      <h1>${isLastDay ? "Your trial ends today" : `${daysLeft} days left in your trial`}</h1>
      <p>Hi ${name},</p>
      <p>${isLastDay
        ? "Today is the last day of your free trial."
        : `Your ListingOS trial ends in ${daysLeft} days.`}
      </p>
      <p>Upgrade now to keep creating AI listing videos with your brand kit:</p>
      <ul>
        <li><strong>Solo — $29/mo</strong>: 3 listings/month</li>
        <li><strong>Agent — $79/mo</strong>: 10 listings/month</li>
      </ul>
      <a href="${APP_URL}/dashboard/account" style="background:#1A2E4A;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block">
        Upgrade Now →
      </a>
    `,
  });
}
