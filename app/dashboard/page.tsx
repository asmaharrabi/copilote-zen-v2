import { supabaseServer } from '@/lib/supabase-server';
import DashboardView from './DashboardView';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const { data: conversations } = await supabaseServer
    .from('conversations')
    .select('status, channel, created_at, first_response_at');

  const { data: escalations } = await supabaseServer
    .from('escalations')
    .select('reason, status');

  return (
    <DashboardView
      initialConversations={conversations ?? []}
      initialEscalations={escalations ?? []}
    />
  );
}