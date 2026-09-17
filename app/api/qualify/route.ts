import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { qualifyMessage } from '@/lib/groq';

/**
 * W1 — Qualification automatique
 * 1. Nouveau message  2. Détection langue + intention
 * 3. Score urgence/sentiment  4. Affectation à la bonne file
 *
 * Appelée par le canal d'entrée (web/whatsapp/email) ou par n8n
 * à la réception d'un nouveau message client.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { conversation_id, content, customer_id, order_id, channel } = body;

  if (!content) {
    return NextResponse.json({ error: 'content requis' }, { status: 400 });
  }

  const qualification = await qualifyMessage(content);

  let convId = conversation_id;

  if (!convId) {
    // Nouvelle conversation
    const { data, error } = await supabaseServer
      .from('conversations')
      .insert({
        customer_id,
        order_id,
        channel: channel ?? 'web',
        language: qualification.language,
        sentiment: qualification.sentiment,
        urgency_score: qualification.urgency,
        priority: computePriority(qualification.urgency, 0),
      })
      .select('id')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    convId = data.id;
  } else {
    await supabaseServer
      .from('conversations')
      .update({
        language: qualification.language,
        sentiment: qualification.sentiment,
        urgency_score: qualification.urgency,
        updated_at: new Date().toISOString(),
      })
      .eq('id', convId);
  }

  await supabaseServer.from('messages').insert({
    conversation_id: convId,
    author_type: 'client',
    content,
  });

  // Cas limite : colère détectée ou urgence forte -> déclenche l'escalade (W3)
  if (qualification.sentiment === 'colere' || qualification.urgency > 0.8) {
    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/escalate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversation_id: convId,
        reason: qualification.sentiment === 'colere' ? 'colere_client' : 'confiance_faible',
      }),
    });
  }

  return NextResponse.json({ conversation_id: convId, qualification });
}

// Priorité affichée dans l'Inbox = combinaison urgence détectée + temps d'attente.
function computePriority(urgency: number, waitMinutes: number) {
  return Math.round((urgency * 70 + Math.min(waitMinutes, 300) / 300 * 30) * 100) / 100;
}
