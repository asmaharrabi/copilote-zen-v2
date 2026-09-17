import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export type RagSource = {
  article_id: string;
  title: string;
  excerpt: string;
  similarity: number;
};

type GenerateResult = {
  answer: string;
  confidence: number; // 0-1
};

/**
 * Génère une réponse sourcée à partir des passages RAG trouvés.
 * Si aucune source pertinente n'est trouvée, l'IA doit répondre qu'elle ne sait pas
 * plutôt que d'inventer (cas limite "question hors base documentaire").
 */
export async function generateSourcedAnswer(
  customerMessage: string,
  sources: RagSource[],
  language: 'fr' | 'ar' | 'en'
): Promise<GenerateResult> {
  const languageLabel = { fr: 'français', ar: 'arabe', en: 'anglais' }[language];

  if (sources.length === 0 || sources[0].similarity < 0.3) {
    return {
      answer:
        language === 'ar'
          ? 'لا أملك معلومات كافية في قاعدة المعرفة للرد بدقة على هذا السؤال. سيتحقق أحد الوكلاء من طلبك.'
          : "Je n'ai pas d'information fiable dans la base de connaissances pour répondre précisément à cette question. Un agent va vérifier votre demande.",
      confidence: 0.1,
    };
  }

  const context = sources
    .map((s, i) => `[Source ${i + 1} — ${s.title}]\n${s.excerpt}`)
    .join('\n\n');

  const completion = await groq.chat.completions.create({
    model: 'openai/gpt-oss-120b',
    temperature: 0.2,
    messages: [
      {
        role: 'system',
        content: `Tu es l'assistant du support client ZEN. Réponds UNIQUEMENT à partir des sources fournies, de façon concise et factuelle, en ${languageLabel}. Si les sources ne couvrent pas la question, dis-le explicitement au lieu d'inventer. Ne mentionne pas que tu es une IA.`,
      },
      {
        role: 'user',
        content: `Question du client :\n${customerMessage}\n\nSources disponibles :\n${context}`,
      },
    ],
  });

  const answer = completion.choices[0]?.message?.content?.trim() ?? '';
  // Score de confiance composite : similarité moyenne des sources utilisées.
  const avgSimilarity =
    sources.reduce((sum, s) => sum + s.similarity, 0) / sources.length;

  return { answer, confidence: Math.min(0.98, avgSimilarity) };
}

type Qualification = {
  language: 'fr' | 'ar' | 'en';
  intent: string;
  urgency: number; // 0-1
  sentiment: 'positif' | 'neutre' | 'negatif' | 'colere';
};

/**
 * Qualification automatique d'un message entrant (W1) :
 * détection langue + intention, score urgence/sentiment.
 */
export async function qualifyMessage(content: string): Promise<Qualification> {
  const completion = await groq.chat.completions.create({
    model: 'openai/gpt-oss-120b',
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'Analyse le message client et réponds UNIQUEMENT en JSON avec les clés : ' +
          'language ("fr"|"ar"|"en"), intent (courte étiquette libre, ex: "suivi_commande"), ' +
          'urgency (nombre 0 à 1), sentiment ("positif"|"neutre"|"negatif"|"colere").',
      },
      { role: 'user', content },
    ],
  });

  try {
    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? '{}');
    return {
      language: parsed.language ?? 'fr',
      intent: parsed.intent ?? 'inconnu',
      urgency: Math.max(0, Math.min(1, Number(parsed.urgency) || 0)),
      sentiment: parsed.sentiment ?? 'neutre',
    };
  } catch {
    // Fallback prudent si le modèle ne renvoie pas un JSON valide.
    return { language: 'fr', intent: 'inconnu', urgency: 0.2, sentiment: 'neutre' };
  }
}
