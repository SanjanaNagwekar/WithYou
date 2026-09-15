import type { AuthEnvironment } from '@/lib/config';

type AuthEmail = {
  to: string;
  subject: string;
  heading: string;
  copy: string;
  action: string;
  url: string;
};

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character]!,
  );
}

export function emailDeliveryConfigured(config: AuthEnvironment): boolean {
  return Boolean(config.RESEND_API_KEY && config.AUTH_EMAIL_FROM);
}

export async function sendAuthEmail(config: AuthEnvironment, email: AuthEmail): Promise<void> {
  if (!config.RESEND_API_KEY || !config.AUTH_EMAIL_FROM) {
    throw new Error('Authentication email delivery is not configured.');
  }

  const safeUrl = escapeHtml(email.url);
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: config.AUTH_EMAIL_FROM,
      to: [email.to],
      subject: email.subject,
      html: `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#343d35;line-height:1.6"><h1>${escapeHtml(email.heading)}</h1><p>${escapeHtml(email.copy)}</p><p><a href="${safeUrl}" style="display:inline-block;padding:12px 18px;border-radius:6px;background:#465c46;color:#fff;text-decoration:none">${escapeHtml(email.action)}</a></p><p style="font-size:12px;color:#777e73">If you did not request this, you can ignore this email.</p></body></html>`,
      text: `${email.heading}\n\n${email.copy}\n\n${email.url}\n\nIf you did not request this, you can ignore this email.`,
    }),
  });

  if (!response.ok) {
    throw new Error(`Authentication email delivery failed with status ${response.status}.`);
  }
}
