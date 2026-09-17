'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { StatusBadge, ConfidenceBadge } from '@/components/Badges';

const CURRENT_AGENT_ID = '11111111-1111-1111-1111-111111111111'; // démo — remplacer par la session réelle

type Message = {
  id: string;
  author_type: 'client' | 'ia' | 'agent' | 'systeme';
  content: string;
  ai_sources: { article_id: string; title: string; excerpt: string; similarity: number }[] | null;
  ai_confidence: number | null;
  ai_status: string | null;
  created_at: string;
};

export default function ConversationView({
  conversation,
  initialMessages,
}: {
  conversation: any;
  initialMessages: Message[];
}) {
  const router = useRouter();
  const [messages, setMessages] = useState(initialMessages);
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [loadingGenerate, setLoadingGenerate] = useState(false);
  const [status, setStatus] = useState(conversation.status);
  const [resolving, setResolving] = useState(false);

  // Fetch défensif au montage : ne fait pas confiance aux props serveur,
  // qui peuvent venir d'un rendu RSC mis en cache par le Router Cache de Next.js.
  useEffect(() => {
    let cancelled = false;

    async function loadFresh() {
      const [{ data: freshConv, error: convErr }, { data: freshMessages, error: msgErr }] = await Promise.all([
        supabaseBrowser.from('conversations').select('status').eq('id', conversation.id).single(),
        supabaseBrowser
          .from('messages')
          .select('*')
          .eq('conversation_id', conversation.id)
          .order('created_at', { ascending: true }),
      ]);

      if (cancelled) return;
      if (convErr) console.error('[mount fetch] conversation error', convErr);
      if (msgErr) console.error('[mount fetch] messages error', msgErr);
      if (freshConv) setStatus(freshConv.status);
      if (freshMessages) setMessages(freshMessages as Message[]);
    }

    loadFresh();
    return () => {
      cancelled = true;
    };
  }, [conversation.id]);

  useEffect(() => {
    const channel = supabaseBrowser
      .channel(`conversation-${conversation.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversation.id}` },
        async (payload) => {
          console.log('[realtime:conversation] messages event', payload);
          const { data, error } = await supabaseBrowser
            .from('messages')
            .select('*')
            .eq('conversation_id', conversation.id)
            .order('created_at', { ascending: true });
          if (error) console.error('[realtime:conversation] refetch messages error', error);
          if (data) setMessages(data as Message[]);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversations', filter: `id=eq.${conversation.id}` },
        (payload) => {
          console.log('[realtime:conversation] conversations event', payload);
          setStatus(payload.new.status);
        }
      )
      .subscribe((status, err) => {
        console.log('[realtime:conversation] canal =', status, err ?? '');
      });

    return () => {
      supabaseBrowser.removeChannel(channel);
    };
  }, [conversation.id]);

  async function handleGenerate() {
    setLoadingGenerate(true);
    await fetch(`/api/messages/${conversation.id}/generate`, { method: 'POST' });
    setLoadingGenerate(false);
  }

  async function handleSend(messageId: string, action: 'valider' | 'modifier' | 'refuser') {
    const final_content = editing[messageId];
    await fetch(`/api/messages/${messageId}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent_id: CURRENT_AGENT_ID, final_content, action }),
    });
  }

  async function handleResolve() {
    setResolving(true);
    try {
      const res = await fetch(`/api/conversations/${conversation.id}/resolve`, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert(body.error ?? 'Échec de la résolution');
        return;
      }
      const { conversation: updated } = await res.json();
      setStatus(updated.status);
      router.refresh();
    } finally {
      setResolving(false);
    }
  }

  const pendingAi = messages.filter((m) => m.author_type === 'ia' && m.ai_status === 'proposee');

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col p-6 overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-lg font-medium">{conversation.customers?.full_name ?? 'Client inconnu'}</h1>
            <p className="text-sm text-muted">{conversation.customers?.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={status} />
            {status !== 'resolu' && (
              <button
                onClick={handleResolve}
                disabled={resolving}
                className="rounded border border-line px-3 py-1 text-xs font-medium hover:bg-canvas disabled:opacity-50"
              >
                {resolving ? 'Enregistrement…' : 'Marquer comme résolu'}
              </button>
            )}
          </div>
        </div>

        <div className="space-y-3 flex-1">
          {messages.map((m) => (
            <MessageBubble
              key={m.id}
              message={m}
              editingValue={editing[m.id]}
              onEditChange={(val) => setEditing((prev) => ({ ...prev, [m.id]: val }))}
              onValidate={() => handleSend(m.id, 'valider')}
              onModify={() => handleSend(m.id, 'modifier')}
              onRefuse={() => handleSend(m.id, 'refuser')}
            />
          ))}
        </div>

        {pendingAi.length === 0 && (
          <button
            onClick={handleGenerate}
            disabled={loadingGenerate}
            className="mt-4 self-start rounded bg-zen px-4 py-2 text-sm font-medium text-zen-ink hover:bg-zen-dark hover:text-white disabled:opacity-50"
          >
            {loadingGenerate ? 'Génération…' : 'Générer une réponse IA'}
          </button>
        )}
      </div>

      <aside className="w-72 shrink-0 border-l border-line bg-surface p-5 space-y-5 overflow-y-auto">
        <section>
          <h2 className="text-xs font-medium text-faint mb-2">Fiche client</h2>
          <dl className="text-sm space-y-1">
            <Row label="Nom" value={conversation.customers?.full_name} />
            <Row label="Email" value={conversation.customers?.email} />
            <Row label="Téléphone" value={conversation.customers?.phone} />
            <Row label="Langue" value={conversation.language} />
          </dl>
        </section>

        <section>
          <h2 className="text-xs font-medium text-faint mb-2">Commande liée</h2>
          {conversation.orders ? (
            <dl className="text-sm space-y-1">
              <Row label="Numéro" value={conversation.orders.order_number} />
              <Row label="Statut" value={conversation.orders.status} />
              <Row label="Montant" value={`${conversation.orders.total_amount} TND`} />
            </dl>
          ) : (
            <p className="text-sm text-faint">Aucune commande liée à cette conversation.</p>
          )}
        </section>
      </aside>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-faint">{label}</dt>
      <dd className="text-ink text-right">{value ?? '—'}</dd>
    </div>
  );
}

function MessageBubble({
  message,
  editingValue,
  onEditChange,
  onValidate,
  onModify,
  onRefuse,
}: {
  message: Message;
  editingValue?: string;
  onEditChange: (value: string) => void;
  onValidate: () => void;
  onModify: () => void;
  onRefuse: () => void;
}) {
  const isClient = message.author_type === 'client';
  const isPendingAi = message.author_type === 'ia' && message.ai_status === 'proposee';

  return (
    <div className={`flex ${isClient ? 'justify-start' : 'justify-end'}`}>
      <div className={`max-w-lg rounded p-3 ${isClient ? 'bg-canvas' : 'bg-zen-soft'}`}>
        <div className="flex items-center gap-2 mb-1 text-xs text-faint">
          <span>{authorLabel(message.author_type)}</span>
          {message.ai_confidence != null && <ConfidenceBadge confidence={message.ai_confidence} />}
          {message.ai_status && message.ai_status !== 'proposee' && (
            <span className="italic">({statusLabel(message.ai_status)})</span>
          )}
        </div>

        {isPendingAi ? (
          <textarea
            className="w-full rounded border border-line bg-white p-2 text-sm"
            rows={3}
            defaultValue={message.content}
            onChange={(e) => onEditChange(e.target.value)}
          />
        ) : (
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        )}

        {message.ai_sources && message.ai_sources.length > 0 && (
          <details className="mt-2 text-xs text-muted">
            <summary className="cursor-pointer text-zen-dark">
              {message.ai_sources.length} source(s) consultée(s)
            </summary>
            <ul className="mt-1 space-y-1">
              {message.ai_sources.map((s) => (
                <li key={s.article_id} className="border-l-2 border-zen pl-2">
                  <span className="font-medium">{s.title}</span> — {Math.round(s.similarity * 100)}%
                  <p className="text-faint">{s.excerpt.slice(0, 120)}…</p>
                </li>
              ))}
            </ul>
          </details>
        )}

        {isPendingAi && (
          <div className="mt-2 flex gap-2">
            <button onClick={onValidate} className="rounded bg-zen px-3 py-1 text-xs font-medium text-zen-ink hover:bg-zen-dark hover:text-white">
              Valider et envoyer
            </button>
            <button onClick={onModify} className="rounded border border-line px-3 py-1 text-xs font-medium hover:bg-canvas">
              Envoyer la correction
            </button>
            <button onClick={onRefuse} className="rounded border border-status-escalated px-3 py-1 text-xs font-medium text-status-escalated hover:bg-status-escalatedSoft">
              Refuser
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function authorLabel(type: Message['author_type']) {
  return { client: 'Client', ia: 'IA', agent: 'Agent', systeme: 'Système' }[type];
}

function statusLabel(status: string) {
  return { validee: 'validée', modifiee: 'modifiée', refusee: 'refusée' }[status] ?? status;
}