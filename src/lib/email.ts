import { Resend } from 'resend';

// Initialize Resend with the private API key
const resend = new Resend(process.env.RESEND_API_KEY);

// Dynamically extract domain name from public site URL (e.g. "njlrii.com")
const getSenderDomain = (): string => {
  if (process.env.EMAIL_FROM_DOMAIN) {
    return process.env.EMAIL_FROM_DOMAIN;
  }
  try {
    const liveUrl = process.env.NEXT_PUBLIC_LIVE_SITE_URL || 'https://www.njlrii.com';
    return new URL(liveUrl).hostname.replace('www.', '');
  } catch (error) {
    return 'njlrii.com';
  }
};

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  fromName?: string;
  replyTo?: string;
}

/**
 * Dispatches an automated email using Resend.
 * @param params Details of the email to send (recipient, subject, body, sender alias)
 */
export async function sendEmail({
  to,
  subject,
  html,
  fromName = 'NJLRII Journal',
  replyTo
}: SendEmailParams) {
  const domain = getSenderDomain();
  const fromAddress = `${fromName} <submission@${domain}>`;
  
  // Allow fallback to custom environment variable, otherwise default to support inbox
  const defaultReplyTo = process.env.REPLY_TO_EMAIL || `submission@${domain}`;
  const finalReplyTo = replyTo || defaultReplyTo;

  if (!process.env.RESEND_API_KEY) {
    console.warn('[EMAIL WARNING] RESEND_API_KEY is not defined. Email dispatch was bypassed.');
    return { success: false, error: 'API key missing' };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: [to],
      subject: subject,
      html: html,
      replyTo: finalReplyTo,
    });

    if (error) {
      console.error('[EMAIL ERROR] Resend dispatch failed:', error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (err: any) {
    console.error('[EMAIL EXCEPTION] Failed to dispatch email:', err);
    return { success: false, error: err.message || err };
  }
}
