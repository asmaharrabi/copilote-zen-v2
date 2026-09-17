'use client';

import { useMemo, useState } from 'react';

const CURRENT_USER_ID = '22222222-2222-2222-2222-222222222222'; // démo — superviseur

type Article = {
  id: string;
  title: string;
  content: string;
  category: string;
  status: 'brouillon' | 'publie';
  updated_at: string;
};

export default function FaqManager({ initialArticles }: { initialArticles: Article[] }) {
  const [articles, setArticles] = useState(initialArticles);
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState({ title: '', content: '', category: 'general' });
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(
    () =>
      articles.filter(
        (a) =>
          a.title.toLowerCase().includes(search.toLowerCase()) ||
          a.content.toLowerCase().includes(search.toLowerCase())
      ),
    [articles, search]
  );

  async function handleCreate() {
    if (!draft.title || !draft.content) return;
    setCreating(true);
    const res = await fetch('/api/faq', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...draft, status: 'brouillon', created_by: CURRENT_USER_ID }),
    });
    const data = await res.json();

    if (!res.ok || !data.article) {
      alert(`Échec de la création : ${data.error ?? 'erreur inconnue'}`);
      setCreating(false);
      return;
    }

    setArticles((prev) => [data.article, ...prev]);
    setDraft({ title: '', content: '', category: 'general' });
    setCreating(false);
  }

  async function togglePublish(article: Article) {
    const nextStatus = article.status === 'publie' ? 'brouillon' : 'publie';
    await fetch(`/api/faq/${article.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    });
    setArticles((prev) =>
      prev.map((a) => (a.id === article.id ? { ...a, status: nextStatus } : a))
    );
  }

  async function handleDelete(id: string) {
    await fetch(`/api/faq/${id}`, { method: 'DELETE' });
    setArticles((prev) => prev.filter((a) => a.id !== id));
  }

  return (
    <div className="grid grid-cols-[1fr_320px] gap-5">
      <div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un article…"
          className="w-full rounded border border-line bg-surface px-3 py-2 text-sm mb-4"
        />

        <div className="space-y-2">
          {filtered.map((article) => (
            <div key={article.id} className="rounded border border-line bg-surface p-3 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{article.title}</span>
                  <span
                    className={`badge ${
                      article.status === 'publie'
                        ? 'bg-status-resolvedSoft text-status-resolved'
                        : 'bg-status-progressSoft text-status-progress'
                    }`}
                  >
                    {article.status === 'publie' ? 'Publié' : 'Brouillon'}
                  </span>
                  <span className="text-xs text-faint">{article.category}</span>
                </div>
                <p className="text-sm text-muted mt-1 line-clamp-2">{article.content}</p>
              </div>
              <div className="flex gap-2 shrink-0 ml-3">
                <button
                  onClick={() => togglePublish(article)}
                  className="text-xs font-medium text-zen-dark hover:underline"
                >
                  {article.status === 'publie' ? 'Repasser en brouillon' : 'Publier'}
                </button>
                <button
                  onClick={() => handleDelete(article.id)}
                  className="text-xs font-medium text-status-escalated hover:underline"
                >
                  Supprimer
                </button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-sm text-faint text-center py-8">Aucun article trouvé.</p>
          )}
        </div>
      </div>

      <div className="rounded border border-line bg-surface p-4 h-fit">
        <h2 className="text-sm font-medium mb-3">Nouvel article</h2>
        <div className="space-y-2">
          <input
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            placeholder="Titre"
            className="w-full rounded border border-line px-3 py-2 text-sm"
          />
          <textarea
            value={draft.content}
            onChange={(e) => setDraft((d) => ({ ...d, content: e.target.value }))}
            placeholder="Contenu"
            rows={5}
            className="w-full rounded border border-line px-3 py-2 text-sm"
          />
          <input
            value={draft.category}
            onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
            placeholder="Catégorie"
            className="w-full rounded border border-line px-3 py-2 text-sm"
          />
          <button
            onClick={handleCreate}
            disabled={creating}
            className="w-full rounded bg-zen px-3 py-2 text-sm font-medium text-white hover:bg-zen-dark disabled:opacity-50"
          >
            {creating ? 'Création…' : 'Créer en brouillon'}
          </button>
        </div>
      </div>
    </div>
  );
}