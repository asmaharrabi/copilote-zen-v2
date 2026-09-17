# ZEN — Copilote service client omnicanal

Centre de support qui unifie demandes web, commandes et réponses IA, avec
reprise en main humaine. Un client écrit, l'IA prépare une réponse sourcée
à partir de la base de connaissances, un agent valide/corrige/refuse avant
envoi.

## Installation

### 1. Base de données (Supabase)

1. Créer un projet sur [supabase.com](https://supabase.com) (gratuit).
2. Dans l'éditeur SQL, exécuter dans l'ordre :
   - `supabase/schema.sql`
   - `supabase/seed.sql`
3. Activer Realtime sur les tables `conversations` et `messages`
   (Database > Replication).
4. Récupérer l'URL du projet, la clé `anon` et la clé `service_role`
   (Project Settings > API).

### 2. Variables d'environnement

```bash
cp .env.example .env.local
```

Remplir avec les clés Supabase, une clé Groq (gratuite sur console.groq.com),
une clé OpenAI (pour les embeddings uniquement), l'URL de webhook Slack, et
un secret partagé arbitraire pour `WEBHOOK_SHARED_SECRET`.

### 3. Générer les embeddings des articles seedés

Le seed insère les articles FAQ sans embedding (il faut la clé OpenAI, qui
n'existe pas encore au moment du seed SQL). Une fois l'app lancée, ré-publier
chaque article via l'interface `/faq` (ou un script ponctuel appelant
`PATCH /api/faq/:id` avec le même contenu) pour déclencher le calcul des
embeddings.

### 4. Lancer l'application

```bash
npm install
npm run dev
```

L'app est disponible sur `http://localhost:3000`, redirigée vers `/inbox`.

### 5. Déploiement

Déployer sur Vercel (`vercel deploy`), en renseignant les mêmes variables
d'environnement dans les paramètres du projet.

### 6. n8n

Importer `n8n/workflow-qualification-escalade.json` dans une instance n8n
(cloud ou self-hosted), renseigner les variables d'environnement
`APP_URL`, `WEBHOOK_SHARED_SECRET`, `SLACK_WEBHOOK_URL`, puis activer le
workflow. Le webhook n8n pointe vers `/api/webhook/n8n`.

## Architecture

- **Next.js 14 (App Router) + TypeScript** : frontend et backend dans un
  seul projet (API routes), pour aller vite sans sacrifier la séparation
  des responsabilités.
- **Supabase (PostgreSQL + pgvector + Realtime)** : base de données,
  recherche sémantique, et diffusion temps réel des changements — trois
  besoins couverts par un seul service géré.
- **Groq (Llama 3.3 70B)** : génération des réponses et qualification
  (langue/intention/urgence/sentiment), pour sa rapidité et son coût nul en
  usage démo.
- **OpenAI `text-embedding-3-small`** : uniquement pour les embeddings
  (Groq n'expose pas de modèle d'embedding).
- **n8n** : automatisation périphérique (relais webhook, notification
  Slack sur escalade). La logique métier reste dans l'app Next.js pour
  rester testable et versionnée en TypeScript.

### Workflows

- **W1 — Qualification** (`POST /api/qualify`) : reçoit un message entrant,
  détecte langue/intention/urgence/sentiment via Groq, crée ou met à jour
  la conversation, déclenche l'escalade si besoin.
- **W2 — Réponse assistée** (`POST /api/messages/:id/generate` puis
  `POST /api/messages/:id/send`) : recherche RAG dans les articles publiés
  (pgvector), génération sourcée, validation/correction/refus par l'agent
  avec audit des versions (`message_versions`).
- **W3 — Escalade** (`POST /api/escalate`) : confiance faible ou colère
  détectée → statut `escalade`, ligne dans `escalations`, notification
  Slack.

## Choix assumés et limites

- **Rôles** : un simple champ `role` (`client`/`agent`/`superviseur`) sur
  `users`, appliqué côté UI (masquage des actions de configuration) et en
  filet de sécurité via RLS. Pas de système de permissions granulaire —
  suffisant pour la démo, à renforcer pour de la production.
- **Authentification** : non implémentée (hors périmètre du délai imparti).
  L'agent courant est simulé par une constante côté client
  (`CURRENT_AGENT_ID`). À remplacer par Supabase Auth en production.
- **Détection langue arabe/français** : gérée au niveau du prompt (le
  modèle répond dans la langue détectée), sans pipeline NLP dédié. Fiable
  sur des messages clairs, moins robuste sur du code-switching arabe/latin.
- **Score de confiance** : approximé par la similarité cosinus moyenne des
  sources RAG utilisées, pas par une estimation calibrée du modèle
  générateur — un choix pragmatique, documenté comme tel.
- **Cas "commande introuvable"** : détecté par une expression régulière sur
  le pattern `CMD-XXXXX` dans le message client, faute de temps pour un
  extracteur d'entités plus robuste.
- **Double envoi de webhook** : géré par une clé unique (`event_key`) sur
  une contrainte `PRIMARY KEY`, ce qui suffit à garantir l'idempotence sans
  file de messages dédiée.
- **Pilotage** : indicateurs calculés à la volée par agrégation SQL au
  chargement de la page, sans matérialisation ni rafraîchissement temps
  réel — acceptable au volume de la démo, à revoir avec un vrai volume de
  production (vues matérialisées ou job planifié).
- **Emails (Resend)** : la clé est prévue dans `.env.example` mais l'envoi
  d'email transactionnel (accusé de réception client) n'est pas branché
  dans le code fourni — à ajouter dans `/api/messages/:id/send` si le
  canal email doit notifier le client.

## Jeu de données de démonstration

`supabase/seed.sql` contient 2 utilisateurs (agent + superviseur), 3
clients, 3 commandes, 7 articles FAQ (6 publiés, 1 brouillon), et 3
conversations illustrant les trois statuts clés (nouveau, en cours,
escaladé) sur les trois canaux (web, whatsapp, email).
