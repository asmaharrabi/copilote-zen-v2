# ZEN — Copilote service client omnicanal

Centre de support qui unifie demandes web, commandes et réponses IA, avec
reprise en main humaine. Un client écrit, l'IA prépare une réponse sourcée
à partir de la base de connaissances (et des données de commande), un agent
valide/corrige/refuse avant envoi.

## Installation

### 1. Base de données (Supabase)

1. Créer un projet sur [supabase.com](https://supabase.com) (gratuit).
2. Dans l'éditeur SQL, exécuter dans l'ordre :
   - `supabase/schema.sql`
   - `supabase/seed.sql`
3. Activer Realtime sur `conversations` et `messages` (le toggle du
   dashboard n'est pas toujours au même endroit selon les versions — le
   plus fiable est de l'exécuter directement en SQL) :
   ```sql
   alter publication supabase_realtime add table messages;
   alter publication supabase_realtime add table conversations;
   ```
4. Récupérer l'URL du projet, la clé `anon` et la clé `service_role`
   (Project Settings > API — l'"API URL" affichée dans Data API convient).

### 2. Variables d'environnement

```bash
cp .env.example .env.local
```

À remplir :
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY` : depuis Supabase.
- `GROQ_API_KEY` : clé gratuite sur console.groq.com (génération des
  réponses et qualification).
- `GOOGLE_API_KEY` : clé gratuite sur aistudio.google.com/apikey
  (embeddings — voir note Architecture ci-dessous).
- `RESEND_API_KEY` : clé gratuite sur resend.com (100 emails/jour sans
  carte bancaire).
- `SLACK_WEBHOOK_URL` : voir api.slack.com/apps > Incoming Webhooks.
- `WEBHOOK_SHARED_SECRET` : une chaîne arbitraire que tu inventes
  toi-même (ex. `openssl rand -hex 32`), à recopier à l'identique côté n8n.
- `NEXT_PUBLIC_APP_URL` : `http://localhost:3000` en local, l'URL Vercel
  en production.

**Redémarre toujours `npm run dev` après toute modification de
`.env.local`** — Next.js ne recharge pas les variables d'environnement à
chaud.

### 3. Générer les embeddings des articles seedés

Le seed insère les articles FAQ sans embedding (ils n'existent qu'après
un premier appel à l'API d'embedding, qui n'a pas de sens à faire depuis
du SQL brut). Une fois l'app lancée, exécute ce script pour forcer le
recalcul de tous les articles :

```powershell
$articles = (Invoke-RestMethod -Uri "http://localhost:3000/api/faq").articles
foreach ($a in $articles) {
  Invoke-RestMethod -Uri "http://localhost:3000/api/faq/$($a.id)" `
    -Method PATCH -ContentType "application/json" `
    -Body (@{ title = $a.title; content = $a.content } | ConvertTo-Json)
  Start-Sleep -Milliseconds 500
}
```

Vérifie ensuite avec :
```sql
select title, embedding is not null as has_embedding from articles_faq;
```

### 4. Lancer l'application

```bash
npm install
npm run dev
```

L'app est disponible sur `http://localhost:3000`, redirigée vers `/inbox`.

### 5. Déploiement

Déployer sur Vercel (`vercel deploy`), en renseignant les mêmes variables
d'environnement dans les paramètres du projet. Le projet Supabase gratuit
se met en pause après 7 jours d'inactivité — le réactiver avant toute
démonstration si le projet n'a pas été ouvert récemment.

### 6. n8n

**Localement** (le plus rapide pour tester sans dépendre d'un déploiement) :
```bash
npx n8n
```
puis ouvrir `http://localhost:5678`, créer un compte local, importer
`n8n/workflow-qualification-escalade.json` (menu ⋯ > Import from File).

Le workflow référence `$env.APP_URL`, `$env.WEBHOOK_SHARED_SECRET` et
`$env.SLACK_WEBHOOK_URL` — si la fonctionnalité "Variables" n'est pas
disponible sur ton instance n8n, remplace directement ces expressions par
les valeurs en dur dans les nodes concernés (URL de l'app, secret webhook,
URL Slack). Le node "Générer clé idempotence" utilise du JavaScript simple
sans `require()`, compatible avec les restrictions de sécurité des
installations n8n récentes.

Pour tester : clic sur "Test workflow" dans l'éditeur, puis :
```powershell
Invoke-RestMethod -Uri "http://localhost:5678/webhook-test/zen-message-entrant" `
  -Method POST -ContentType "application/json" `
  -Body (@{ content = "message de test"; customer_id = "<uuid>"; channel = "web" } | ConvertTo-Json)
```

## Architecture

- **Next.js 14 (App Router) + TypeScript** : frontend et backend dans un
  seul projet (API routes).
- **Supabase (PostgreSQL + pgvector + Realtime)** : base de données,
  recherche sémantique, diffusion temps réel. Deux clients distincts
  (`lib/supabase-browser.ts` avec la clé `anon`, `lib/supabase-server.ts`
  avec la clé `service_role` protégée par `server-only`) pour garantir
  que la clé privilégiée n'est jamais incluse dans le bundle navigateur.
- **Groq (`openai/gpt-oss-120b`)** : génération des réponses et
  qualification (langue/intention/urgence/sentiment). C'est un modèle
  open-weight publié par OpenAI mais servi par l'infrastructure Groq —
  aucune clé ni facturation OpenAI n'intervient ici. (Llama 3.3 70B,
  utilisé initialement, a été décommissionné par Groq le 16 août 2026.)
- **Google Gemini (`gemini-embedding-001`)** : embeddings pour la
  recherche RAG, choisi pour son tier gratuit généreux (Groq n'expose pas
  de modèle d'embedding). Le paramètre `outputDimensionality` demandé à
  l'API n'est pas toujours respecté par le service ; le code tronque donc
  lui-même le vecteur retourné à 768 valeurs pour rester cohérent avec la
  colonne `vector(768)` — sans impact sur le classement par similarité
  cosinus, invariante à la norme du vecteur.
- **Resend** : email transactionnel réellement branché (voir Workflows,
  W2) — pas seulement prévu en configuration.
- **n8n** : automatisation d'ingestion pour les canaux externes qui ne
  peuvent pas appeler directement l'API Next.js (WhatsApp, email...), et
  orchestration de la notification Slack sur ces canaux. La logique
  métier (appel IA, décision d'escalade) reste dans l'app Next.js, pas
  dans n8n — voir la limite "chevauchement" ci-dessous.

### Workflows

- **W1 — Qualification** (`POST /api/qualify`) : reçoit un message
  entrant, détecte langue/intention/urgence/sentiment via Groq, crée ou
  met à jour la conversation, déclenche l'escalade automatiquement si
  colère ou urgence forte.
- **W2 — Réponse assistée** (`POST /api/messages/:id/generate` puis
  `POST /api/messages/:id/send`) : recherche RAG dans les articles
  publiés (pgvector) + injection du statut de la commande liée comme
  source citable, génération sourcée par Groq, validation/correction/
  refus par l'agent avec audit des versions (`message_versions`), envoi
  d'un email réel via Resend quand le canal est `email`.
- **W3 — Escalade** (`POST /api/escalate`) : confiance faible ou colère
  détectée → statut `escalade`, ligne dans `escalations`, notification
  Slack.

## Choix assumés et limites

- **Rôles** : simple champ `role` (`client`/`agent`/`superviseur`) sur
  `users`, appliqué côté UI et en filet de sécurité via RLS. Pas de
  permissions granulaires.
- **Authentification** : non implémentée. L'agent courant est simulé par
  une constante côté client (`CURRENT_AGENT_ID`). À remplacer par
  Supabase Auth en production.
- **Détection langue arabe/français** : gérée au niveau du prompt (le
  modèle répond dans la langue détectée), sans pipeline NLP dédié.
- **Score de confiance** : mesure l'ancrage documentaire de la réponse
  (similarité cosinus moyenne des sources utilisées), pas une estimation
  de la justesse de la réponse elle-même. Une réponse honnête d'absence
  d'information (ex. "commande introuvable") aura donc logiquement un
  score bas même si c'est le bon comportement — choix cohérent avec
  l'exigence de transparence, mais qui peut sembler contre-intuitif dans
  l'UI sans cette explication.
- **Cas "commande introuvable"** : détecté par une expression régulière
  sur le pattern `CMD-XXXXX`, sans extracteur d'entités plus robuste.
- **Double envoi de webhook** : idempotence garantie par une clé unique
  (`event_key`) sur une contrainte `PRIMARY KEY`.
- **Priorité de l'Inbox** : calculée (`urgence × 70 + attente plafonnée
  × 30`) au moment de la qualification, ou fixée à 95 lors d'une
  escalade — mais **non recalculée en continu** avec le temps qui passe.
  Le `wait_minutes` affiché dans l'Inbox, lui, est recalculé en direct
  (vue SQL) ; une conversation ancienne aura donc une attente affichée
  élevée sans que sa priorité augmente automatiquement. Limite assumée,
  corrigible en recalculant la priorité dans la vue `v_inbox` plutôt que
  de la stocker.
- **Pilotage** : indicateurs calculés à la volée par agrégation SQL au
  chargement de la page, sans matérialisation ni temps réel.
- **Emails (Resend)** : fonctionnel, mais bridé par le tier gratuit sans
  domaine vérifié — Resend n'autorise l'envoi que vers l'adresse du
  compte Resend utilisé pour la clé API. En production, la vérification
  d'un domaine (gratuite sur Resend, DNS à la charge de l'entreprise)
  lève cette restriction sans changement de code applicatif.
- **Chevauchement connu app / n8n** : l'app détecte elle-même la colère/
  urgence et déclenche sa propre escalade + notification Slack, pour que
  les conversations créées directement sur le canal web soient couvertes
  sans dépendre de n8n. Le workflow n8n répète ce contrôle et envoie sa
  propre notification Slack pour les messages qui transitent par lui —
  un message arrivé via n8n produit donc deux notifications Slack pour
  un seul événement. Choix assumé pour garder le workflow n8n démontrable
  de bout en bout avec sa propre logique de décision visible ; la
  correction en production consisterait à ne garder la notification
  Slack côté app que pour le canal web direct.

## Jeu de données de démonstration

`supabase/seed.sql` contient 2 utilisateurs (agent + superviseur), 3
clients, 3 commandes, 7 articles FAQ (6 publiés, 1 brouillon), et 3
conversations illustrant les statuts clés (nouveau, en cours, escaladé)
sur les trois canaux (web, whatsapp, email), incluant les cas limites
"commande introuvable" et "client en colère".