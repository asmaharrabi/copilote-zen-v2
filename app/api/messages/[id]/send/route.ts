import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { sendCustomerEmail } from '@/lib/resend';

/**
 * W2 — Réponse assistée (étapes 3-4)
 * 3. Validation agent  4. Envoi + journalisation
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const messageId = params.id;
  const { agent_id, final_content, action } = await req.json();

  const { data: original, error: fetchError } = await supabaseServer
    .from('messages')
    .select('*')
    .eq('id', messageId)
    .single();

  if (fetchError || !original) {
    return NextResponse.json({ error: 'Message introuvable' }, { status: 404 });
  }

  if (action === 'refuser') {
    await supabaseServer.from('messages').update({ ai_status: 'refusee' }).eq('id', messageId);
    return NextResponse.json({ status: 'refusee' });
  }

  const wasEdited = final_content && final_content !== original.content;

  if (wasEdited) {
    const { count } = await supabaseServer
      .from('message_versions')
      .select('*', { count: 'exact', head: true })
      .eq('message_id', messageId);

    await supabaseServer.from('message_versions').insert({
      message_id: messageId,
      version_number: (count ?? 0) + 1,
      content: final_content,
      edited_by: agent_id,
    });
  }

  const finalContent = final_content ?? original.content;

  const { data: updated, error: updateError } = await supabaseServer
    .from('messages')
    .update({
      content: finalContent,
      ai_status: wasEdited ? 'modifiee' : 'validee',
      author_id: agent_id,
    })
    .eq('id', messageId)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const now = new Date().toISOString();
  await supabaseServer
    .from('conversations')
    .update({ status: 'en_cours', first_response_at: now, updated_at: now })
    .eq('id', original.conversation_id)
    .is('first_response_at', null);

  await supabaseServer
    .from('conversations')
    .update({ status: 'en_cours', updated_at: now })
    .eq('id', original.conversation_id);

  const { data: conversation } = await supabaseServer
    .from('conversations')
    .select('channel, customers(email)')
    .eq('id', original.conversation_id)
    .single();

  let emailSent = false;
  if (conversation?.channel === 'email' && (conversation as any).customers?.email) {
    emailSent = await sendCustomerEmail(
      (conversation as any).customers.email,
      'Réponse à votre demande — Support ZEN',
      finalContent
    );
  }

  return NextResponse.json({ message: updated, email_sent: emailSent });
}