import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { embedText } from '@/lib/rag';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { title, content, category, status } = await req.json();

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (title) updates.title = title;
  if (content) updates.content = content;
  if (category) updates.category = category;
  if (status) updates.status = status;

  // Ré-embedding uniquement si le contenu textuel change (évite un appel inutile).
  if (title || content) {
    const { data: current } = await supabaseServer
      .from('articles_faq')
      .select('title, content')
      .eq('id', params.id)
      .single();

    updates.embedding = await embedText(
      `${title ?? current?.title}\n${content ?? current?.content}`
    );
  }

  const { data, error } = await supabaseServer
    .from('articles_faq')
    .update(updates)
    .eq('id', params.id)
    .select('id, title, content, category, status')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ article: data });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await supabaseServer.from('articles_faq').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
