import { supabaseServer } from '@/lib/supabase-server';
import InboxList from './InboxList';

export const dynamic = 'force-dynamic';

export default async function InboxPage() {
  const { data: rows } = await supabaseServer
    .from('v_inbox')
    .select('*')
    .order('priority', { ascending: false });

  return (
    <div className="p-6">
      <div className="flex items-baseline justify-between mb-5">
        <h1 className="text-lg font-medium">Inbox</h1>
        <p className="text-sm text-muted">{rows?.length ?? 0} conversations</p>
      </div>
      <InboxList initialRows={rows ?? []} />
    </div>
  );
}
