'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { StatusBadge, SentimentBadge, ChannelBadge } from '@/components/Badges';

type InboxRow = {
  id: string;
  channel: string;
  status: string;
  sentiment: string;
  priority: number;
  wait_minutes: number;
  customer_name: string | null;
  order_number: string | null;
  last_message: string | null;
};

export default function InboxList({ initialRows }: { initialRows: InboxRow[] }) {
  const [rows, setRows] = useState(initialRows);

  useEffect(() => {
    // Temps réel : tout changement sur `conversations` ou `messages` rafraîchit
    // la vue sans rechargement complet (exigence "temps réel").
    const channel = supabaseBrowser
  .channel('inbox-updates')
  .on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'conversations' },
    (payload) => {
      console.log('🔥 CONVERSATION EVENT:', payload);
      refresh();
    }
  )
  .on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'messages' },
    (payload) => {
      console.log('🔥 MESSAGE EVENT:', payload);
      refresh();
    })

    .on(
  'postgres_changes',
  {
    event: '*',
    schema: 'public',
    table: 'customers',
  },
  () => {
    refresh();
  }
)
  
  .subscribe((status) => {
    console.log('Realtime status:', status);
  });

    async function refresh() {
  const { data, error } = await supabaseBrowser
    .from('v_inbox')
    .select('*')
    .order('priority', { ascending: false });

  console.log('🔥 INBOX REFRESH:', {
    data,
    error,
    count: data?.length,
    priorities: data?.map((row) => ({
      id: row.id,
      priority: row.priority,
      customer: row.customer_name,
      message: row.last_message,
    })),
  });

  if (error) {
    console.error('❌ Erreur refresh inbox:', error);
    return;
  }

  if (data) {
  const newRows = data as InboxRow[];

  console.log('🔥 SETTING ROWS:', newRows);

  setRows(newRows);
}
}

    return () => {
      supabaseBrowser.removeChannel(channel);
    };
  }, []);
  console.log('🟢 RENDER ROWS:', rows);
  if (rows.length === 0) {
    return (
      <div className="rounded border border-line bg-surface p-10 text-center text-sm text-muted">
        Aucune conversation pour le moment. Les nouveaux messages apparaîtront ici automatiquement.
      </div>
    );
  }

  return (
    <div className="rounded border border-line bg-surface overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs text-faint">
            <th className="px-4 py-2.5 font-medium">Client</th>
            <th className="px-4 py-2.5 font-medium">Canal</th>
            <th className="px-4 py-2.5 font-medium">Dernier message</th>
            <th className="px-4 py-2.5 font-medium">Statut</th>
            <th className="px-4 py-2.5 font-medium">Sentiment</th>
            <th className="px-4 py-2.5 font-medium">Attente</th>
            <th className="px-4 py-2.5 font-medium">Priorité</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-line last:border-0 hover:bg-canvas">
              <td className="px-4 py-3">
                <Link href={`/inbox/${row.id}`} className="font-medium hover:text-zen-dark">
                  {row.customer_name ?? 'Client inconnu'}
                </Link>
                {row.order_number && (
                  <div className="text-xs text-faint font-mono">{row.order_number}</div>
                )}
              </td>
              <td className="px-4 py-3">
                <ChannelBadge channel={row.channel} />
              </td>
              <td className="px-4 py-3 max-w-xs truncate text-muted">{row.last_message}</td>
              <td className="px-4 py-3">
                <StatusBadge status={row.status} />
              </td>
              <td className="px-4 py-3">
                <SentimentBadge sentiment={row.sentiment} />
              </td>
              <td className="px-4 py-3 font-mono text-xs text-muted">
                {Math.round(row.wait_minutes)} min
              </td>
              <td className="px-4 py-3 font-mono text-xs">{row.priority.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
