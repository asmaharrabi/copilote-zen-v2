-- ============================================================
-- Copilote service client omnicanal — schéma PostgreSQL + pgvector
-- ============================================================

create extension if not exists vector;
create extension if not exists pgcrypto;

-- ---------- Utilisateurs & rôles ----------
create type user_role as enum ('client', 'agent', 'superviseur');

create table users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  full_name text not null,
  role user_role not null default 'agent',
  created_at timestamptz not null default now()
);

-- ---------- Clients & commandes ----------
create table customers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text,
  phone text,
  preferred_language text not null default 'fr', -- 'fr' | 'ar' | 'en'
  created_at timestamptz not null default now()
);

create type order_status as enum ('en_preparation', 'expediee', 'livree', 'annulee');

create table orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique not null,
  customer_id uuid references customers(id) on delete set null,
  status order_status not null default 'en_preparation',
  total_amount numeric(10,2) not null,
  items jsonb not null default '[]',
  created_at timestamptz not null default now()
);

-- ---------- Base de réponses (FAQ + RAG) ----------
create type article_status as enum ('brouillon', 'publie');

create table articles_faq (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  category text not null default 'general',
  status article_status not null default 'brouillon',
  embedding vector(1536), -- text-embedding-3-small
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index articles_faq_embedding_idx on articles_faq
  using hnsw (embedding vector_cosine_ops);

-- ---------- Conversations ----------
create type conversation_channel as enum ('web', 'email', 'whatsapp');
create type conversation_status as enum ('nouveau', 'en_cours', 'resolu', 'escalade');
create type sentiment_type as enum ('positif', 'neutre', 'negatif', 'colere');

create table conversations (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id) on delete set null,
  order_id uuid references orders(id) on delete set null,
  channel conversation_channel not null default 'web',
  status conversation_status not null default 'nouveau',
  sentiment sentiment_type not null default 'neutre',
  language text not null default 'fr', -- langue détectée du dernier message client
  urgency_score numeric(4,2) not null default 0, -- 0-1, calculé par la qualification
  priority numeric(6,2) not null default 0, -- score composite affiché dans l'inbox
  assigned_agent_id uuid references users(id),
  first_response_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index conversations_status_idx on conversations(status);
create index conversations_priority_idx on conversations(priority desc);

-- ---------- Messages ----------
create type message_author_type as enum ('client', 'ia', 'agent', 'systeme');

create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  author_type message_author_type not null,
  author_id uuid references users(id),
  content text not null,
  -- Pour les réponses IA :
  ai_sources jsonb, -- [{article_id, title, excerpt, similarity}]
  ai_confidence numeric(4,2), -- 0-1
  ai_status text, -- 'proposee' | 'validee' | 'modifiee' | 'refusee'
  created_at timestamptz not null default now()
);

create index messages_conversation_idx on messages(conversation_id, created_at);

-- ---------- Audit des corrections humaines ----------
-- Conserve chaque version d'un message corrigé par un agent : auteur, date, version.
create table message_versions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references messages(id) on delete cascade,
  version_number int not null,
  content text not null,
  edited_by uuid not null references users(id),
  edited_at timestamptz not null default now()
);

create unique index message_versions_unique on message_versions(message_id, version_number);

-- ---------- Escalades ----------
create type escalation_reason as enum ('confiance_faible', 'colere_client', 'demande_agent');
create type escalation_status as enum ('ouverte', 'en_traitement', 'resolue');

create table escalations (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  reason escalation_reason not null,
  status escalation_status not null default 'ouverte',
  slack_notified_at timestamptz,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- ---------- Idempotence des webhooks (anti double-envoi) ----------
create table webhook_events (
  event_key text primary key, -- clé unique fournie par l'émetteur (ex: n8n execution id + step)
  received_at timestamptz not null default now(),
  payload jsonb
);

-- ---------- Vue support pour l'Inbox (statut, canal, délai, sentiment, priorité) ----------
create view v_inbox as
select
  c.id,
  c.channel,
  c.status,
  c.sentiment,
  c.language,
  c.priority,
  c.urgency_score,
  cu.full_name as customer_name,
  o.order_number,
  extract(epoch from (now() - c.created_at)) / 60 as wait_minutes,
  (select content from messages m where m.conversation_id = c.id order by m.created_at desc limit 1) as last_message,
  c.updated_at
from conversations c
left join customers cu on cu.id = c.customer_id
left join orders o on o.id = c.order_id
order by c.priority desc, c.created_at asc;

-- ---------- Fonction de recherche sémantique (RAG) ----------
create or replace function match_articles_faq(query_embedding vector(1536), match_count int)
returns table (id uuid, title text, content text, similarity float)
language sql stable
as $$
  select
    id,
    title,
    content,
    1 - (embedding <=> query_embedding) as similarity
  from articles_faq
  where status = 'publie' and embedding is not null
  order by embedding <=> query_embedding
  limit match_count;
$$;

-- ---------- Row Level Security (rôles) ----------
alter table articles_faq enable row level security;
alter table conversations enable row level security;

-- Un agent lit/écrit les conversations mais ne modifie pas les règles globales (FAQ).
create policy agent_read_conversations on conversations
  for select using (true);

create policy agent_write_conversations on conversations
  for update using (true);

-- Seuls agent/superviseur créent des articles ; seul le superviseur peut publier
-- (appliqué aussi côté API, RLS ici en filet de sécurité).
create policy faq_read_all on articles_faq for select using (true);
