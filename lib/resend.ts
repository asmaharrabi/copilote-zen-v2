import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_ADDRESS = 'ZEN Support <onboarding@resend.dev>';

export async function sendCustomerEmail(
  to: string,
  subject: string,
  content: string
): Promise<boolean> {
  if (!process.env.RESEND_API_KEY || !to) return false;

  try {
    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to,
      subject,
      text: content,
    });
    if (error) {
      console.error('Erreur envoi email Resend:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Erreur envoi email Resend:', err);
    return false;
  }
}