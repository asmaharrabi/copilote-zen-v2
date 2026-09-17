import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

/**
 * W3 — Escalade sensible
 * 1. Confiance faible ou colère  2. Création ticket prioritaire
 * 3. Notification Slack  4. Suivi du délai de résolution
 */
export async function POST(req: NextRequest) {
  const { conversation_id, reason } = await req.json();

  if (!conversation_id || !reason) {
    return NextResponse.json({ error: 'conversation_id et reason requis' }, { status: 400 });
  }

  await supabaseServer
    .from('conversations')
    .update({ status: 'escalade', priority: 95 })
    .eq('id', conversation_id);

  const { data: escalation, error } = await supabaseServer
    .from('escalations')
    .insert({ conversation_id, reason })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const notified = await notifySlack(conversation_id, reason);

  if (notified) {
    await supabaseServer
      .from('escalations')
      .update({ slack_notified_at: new Date().toISOString() })
      .eq('id', escalation.id);
  }

  return NextResponse.json({ escalation_id: escalation.id, slack_notified: notified });
}

async function notifySlack(conversationId: string, reason: string): Promise<boolean> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return false;

  const label = reason === 'colere_client' ? 'Colère client détectée' : 'Confiance IA faible';

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `🚨 Escalade — ${label}\nConversation : ${process.env.NEXT_PUBLIC_APP_URL}/inbox/${conversationId}`,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
