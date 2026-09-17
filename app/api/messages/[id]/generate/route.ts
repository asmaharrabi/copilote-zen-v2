 import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { searchFaq } from '@/lib/rag';
import { generateSourcedAnswer } from '@/lib/groq';

/**
 * W2 — Réponse assistée (étapes 1-2)
 * 1. Recherche RAG  2. Génération avec sources
 * (la validation agent + envoi sont gérés par /send)
 *
 * `[id]` = id de la conversation. On génère une réponse au dernier message client.
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const conversationId = params.id;

  const { data: conversation, error: convError } = await supabaseServer
    .from('conversations')
    .select('*, orders(order_number, status)')
    .eq('id', conversationId)
    .single();

  if (convError || !conversation) {
    return NextResponse.json({ error: 'Conversation introuvable' }, { status: 404 });
  }

  const { data: lastClientMessage } = await supabaseServer
    .from('messages')
    .select('content')
    .eq('conversation_id', conversationId)
    .eq('author_type', 'client')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!lastClientMessage) {
    return NextResponse.json({ error: 'Aucun message client à traiter' }, { status: 400 });
  }

  // Cas limite : commande référencée mais introuvable en base.
  const orderMentioned = /CMD-\d+/i.exec(lastClientMessage.content)?.[0];
  if (orderMentioned && !conversation.order_id) {
    const proposal = {
      conversation_id: conversationId,
      author_type: 'ia' as const,
      content: `Je ne retrouve pas la commande ${orderMentioned} dans notre système. Un agent va vérifier manuellement.`,
      ai_sources: [],
      ai_confidence: 0.15,
      ai_status: 'proposee',
    };
    const { data: msg } = await supabaseServer.from('messages').insert(proposal).select().single();
    return NextResponse.json({ message: msg, note: 'commande_introuvable' });
  }

  const sources = await searchFaq(lastClientMessage.content, 3);

  // Quand une commande est liée à la conversation, on l'ajoute comme source
  // à part entière : l'IA peut répondre directement sur son statut réel
  // (expédiée, en préparation...) plutôt que de basculer systématiquement
  // en "je ne sais pas" pour des questions factuelles sur la commande.
  if (conversation.orders) {
    const orderSource = {
      article_id: `order-${conversation.order_id}`,
      title: `Commande ${conversation.orders.order_number}`,
      excerpt: `Statut actuel de la commande : ${orderStatusLabel(conversation.orders.status)}.`,
      similarity: 0.85,
    };
    sources.unshift(orderSource);
  }

  const { answer, confidence } = await generateSourcedAnswer(
    lastClientMessage.content,
    sources,
    conversation.language
  );

  const { data: aiMessage, error: insertError } = await supabaseServer
    .from('messages')
    .insert({
      conversation_id: conversationId,
      author_type: 'ia',
      content: answer,
      ai_sources: sources,
      ai_confidence: confidence,
      ai_status: 'proposee',
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Confiance faible -> escalade automatique (W3), sans bloquer la réponse à l'agent.
  if (confidence < 0.35) {
    fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/escalate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversation_id: conversationId, reason: 'confiance_faible' }),
    }).catch(() => {});
  }

  return NextResponse.json({ message: aiMessage });
}

function orderStatusLabel(status: string) {
  return (
    {
      en_preparation: 'en préparation',
      expediee: 'expédiée',
      livree: 'livrée',
      annulee: 'annulée',
    }[status] ?? status
  );
}