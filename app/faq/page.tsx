import { supabaseServer } from '@/lib/supabase-server';
import FaqManager from './FaqManager';

export const dynamic = 'force-dynamic';

export default async function FaqPage() {
  const { data: articles } = await supabaseServer
    .from('articles_faq')
    .select('id, title, content, category, status, updated_at')
    .order('updated_at', { ascending: false });

  return (
    <div className="p-6">
      <h1 className="text-lg font-medium mb-5">Base de réponses</h1>
      <FaqManager initialArticles={articles ?? []} />
    </div>
  );
}
