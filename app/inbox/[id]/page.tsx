import { supabaseServer } from '@/lib/supabase-server';
import { notFound } from 'next/navigation';
import ConversationView from './ConversationView';

export const dynamic = 'force-dynamic';

export default async function ConversationPage({ params }: { params: { id: string } }) {
  const { data: conversation } = await supabaseServer
    .from('conversations')
    .select('*, customers(*), orders(*)')
    .eq('id', params.id)
    .single();

  if (!conversation) notFound();

  const { data: messages } = await supabaseServer
    .from('messages')
    .select('*')
    .eq('conversation_id', params.id)
    .order('created_at', { ascending: true });

  return <ConversationView conversation={conversation} initialMessages={messages ?? []} />;
}
