import { supabaseServer } from './supabase-server';
import type { RagSource } from './groq';

const GEMINI_EMBED_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent';

const EMBEDDING_DIMENSIONS = 768; // doit correspondre à vector(768) dans schema.sql

type TaskType = 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY';

export async function embedText(
  text: string,
  taskType: TaskType = 'RETRIEVAL_DOCUMENT'
): Promise<number[]> {
  const res = await fetch(GEMINI_EMBED_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': process.env.GOOGLE_API_KEY!,
    },
    body: JSON.stringify({
      model: 'models/gemini-embedding-001',
      content: { parts: [{ text }] },
      taskType,
      outputDimensionality: EMBEDDING_DIMENSIONS,
    }),
  });

  if (!res.ok) {
    throw new Error(`Échec de la génération d'embedding: ${res.status}`);
  }

  const data = await res.json();
  const values = data.embedding.values as number[];

  // Filet de sécurité : l'API renvoie parfois le vecteur complet (3072) même
  // quand outputDimensionality est demandé. gemini-embedding-001 est entraîné
  // en Matryoshka (MRL) : tronquer aux N premières valeurs reste un embedding
  // valide, et la similarité cosinus (utilisée par pgvector ici) est invariante
  // à la norme du vecteur, donc pas besoin de renormaliser pour notre usage.
  return values.length > EMBEDDING_DIMENSIONS
    ? values.slice(0, EMBEDDING_DIMENSIONS)
    : values;
}

/**
 * Recherche sémantique dans les articles FAQ publiés (pgvector, similarité cosinus).
 * Retourne les passages utilisés + un score de similarité par source
 * (affiché dans l'UI comme "passages consultés" avec score de confiance).
 */
export async function searchFaq(query: string, limit = 3): Promise<RagSource[]> {
  const embedding = await embedText(query, 'RETRIEVAL_QUERY');

  const { data, error } = await supabaseServer.rpc('match_articles_faq', {
    query_embedding: embedding,
    match_count: limit,
  });

  if (error) {
    console.error('Erreur recherche RAG:', error);
    return [];
  }

  return (data ?? []).map((row: any) => ({
    article_id: row.id,
    title: row.title,
    excerpt: row.content.slice(0, 400),
    similarity: row.similarity,
  }));
}