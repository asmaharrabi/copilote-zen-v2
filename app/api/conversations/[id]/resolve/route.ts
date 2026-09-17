import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

/**
 * W3 — Escalade sensible, étape 4 : suivi du délai de résolution.
 * Marque la conversation (et son escalade ouverte le cas échéant) comme résolue,
 * en horodatant `resolved_at` — c'est cette valeur qui alimente le calcul du
 * délai de résolution dans le Pilotage.
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const conversationId = params.id;
  const now = new Date().toISOString();

  const { data: conversation, error } = await supabaseServer
    .from('conversations')
    .update({ status: 'resolu', resolved_at: now, updated_at: now })
    .eq('id', conversationId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabaseServer
    .from('escalations')
    .update({ status: 'resolue', resolved_at: now })
    .eq('conversation_id', conversationId)
    .eq('status', 'ouverte');

  return NextResponse.json({ conversation });
}