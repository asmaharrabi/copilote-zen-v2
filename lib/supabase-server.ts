import 'server-only';
import { createClient } from '@supabase/supabase-js';

// Utilisé uniquement dans les routes API et Server Components.
// `server-only` fait planter le build si ce fichier est jamais importé
// depuis un composant 'use client' — garde-fou contre l'erreur qu'on a eue.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL manquante');
if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY manquante');

export const supabaseServer = createClient(url, key, {
  auth: { persistSession: false },
});
