import { createClient } from '@supabase/supabase-js';

// Utilisé côté composants ('use client') pour le Realtime (websockets).
// Clé publique anon, protégée par RLS. Ne jamais importer ce fichier
// dans le même module que le client service_role (voir supabase-server.ts) :
// même un export non utilisé serait évalué et bundlé côté navigateur.
export const supabaseBrowser = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
