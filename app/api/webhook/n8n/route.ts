import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

/**
 * Point d'entrée générique pour n8n (qualification amont, relances, etc.).
 * Cas limite "double envoi du webhook" : chaque événement porte une clé unique
 * (event_key, ex. execution_id + node) ; si elle existe déjà, on répond 200
 * sans ré-appliquer l'action, plutôt que de traiter deux fois le même message.
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-webhook-secret');
  if (secret !== process.env.WEBHOOK_SHARED_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const payload = await req.json();
  const eventKey = payload.event_key;

  if (!eventKey) {
    return NextResponse.json({ error: 'event_key requis' }, { status: 400 });
  }

  const { error: insertError } = await supabaseServer
    .from('webhook_events')
    .insert({ event_key: eventKey, payload });

  if (insertError) {
    // Violation de contrainte unique = événement déjà reçu -> on ignore silencieusement.
    if (insertError.code === '23505') {
      return NextResponse.json({ status: 'duplicate_ignored' });
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Relaye vers la qualification si le payload contient un nouveau message.
  if (payload.type === 'nouveau_message') {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/qualify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload.data),
    });
    return NextResponse.json(await res.json());
  }

  return NextResponse.json({ status: 'received' });
}
