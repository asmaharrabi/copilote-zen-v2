import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_ADDRESS = 'ZEN Support <onboarding@resend.dev>';

export async function sendCustomerEmail(
  to: string,
  subject: string,
  content: string
): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) {
    console.error('[resend] RESEND_API_KEY manquante dans les variables d\'environnement');
    return false;
  }
  if (!to) {
    console.error('[resend] Adresse destinataire manquante');
    return false;
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to,
      subject,
      text: content,
    });

    if (error) {
      console.error('[resend] Erreur envoi email:', JSON.stringify(error, null, 2));
      return false;
    }

    console.log('[resend] Email envoyé avec succès, id =', data?.id);
    return true;
  } catch (err) {
    console.error('[resend] Exception lors de l\'envoi:', err);
    return false;
  }
}