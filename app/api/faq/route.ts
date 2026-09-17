import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { embedText } from '@/lib/rag';

export async function GET() {
  const { data, error } = await supabaseServer
    .from('articles_faq')
    .select('id, title, content, category, status, created_at, updated_at')
    .order('updated_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ articles: data });
}

export async function POST(req: NextRequest) {
  const { title, content, category, status, created_by } = await req.json();

  if (!title || !content) {
    return NextResponse.json({ error: 'title et content requis' }, { status: 400 });
  }

  // L'embedding est généré à l'écriture pour que l'article soit immédiatement
  // exploitable par la recherche sémantique (RAG) une fois publié.
  const embedding = await embedText(`${title}\n${content}`);

  const { data, error } = await supabaseServer
    .from('articles_faq')
    .insert({
      title,
      content,
      category: category ?? 'general',
      status: status ?? 'brouillon',
      embedding,
      created_by,
    })
    .select('id, title, content, category, status')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ article: data });
}
