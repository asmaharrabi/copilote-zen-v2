-- ============================================================
-- Jeu de données de démonstration
-- ============================================================

insert into users (id, email, full_name, role) values
  ('11111111-1111-1111-1111-111111111111', 'sami.agent@zen.tn', 'Sami Ben Salah', 'agent'),
  ('22222222-2222-2222-2222-222222222222', 'nour.superviseur@zen.tn', 'Nour Trabelsi', 'superviseur');

insert into customers (id, full_name, email, phone, preferred_language) values
  ('33333333-3333-3333-3333-333333333333', 'Asma Harrabi', 'harrabiasma10@gmail.com', '+21620000001', 'fr'),
  ('44444444-4444-4444-4444-444444444444', 'Salma Haddad', 'salma.haddad@mail.com', '+21620000002', 'ar'),
  ('55555555-5555-5555-5555-555555555555', 'John Miller', 'john.miller@mail.com', '+21620000003', 'fr');

insert into orders (id, order_number, customer_id, status, total_amount, items) values
  ('a1111111-0000-0000-0000-000000000001', 'CMD-10234', '33333333-3333-3333-3333-333333333333', 'expediee', 189.90, '[{"name":"Casque audio ZEN X1","qty":1,"price":189.90}]'),
  ('a1111111-0000-0000-0000-000000000002', 'CMD-10255', '44444444-4444-4444-4444-444444444444', 'en_preparation', 79.00, '[{"name":"Montre connectée ZEN Fit","qty":1,"price":79.00}]'),
  ('a1111111-0000-0000-0000-000000000003', 'CMD-10298', '55555555-5555-5555-5555-555555555555', 'livree', 249.50, '[{"name":"Enceinte ZEN Boom","qty":2,"price":124.75}]');

-- Articles FAQ (embeddings à générer via /api/faq après insertion — voir README)
insert into articles_faq (title, content, category, status, created_by) values
  ('Politique de retour', 'Vous pouvez retourner un produit dans les 14 jours suivant la livraison, à condition qu''il soit dans son emballage d''origine. Le remboursement est effectué sous 5 jours ouvrés après réception du colis retourné.', 'retours', 'publie', '22222222-2222-2222-2222-222222222222'),
  ('Délais de livraison', 'Les livraisons standard prennent entre 2 et 5 jours ouvrés en Tunisie. Un email de confirmation avec numéro de suivi est envoyé dès l''expédition.', 'livraison', 'publie', '22222222-2222-2222-2222-222222222222'),
  ('Garantie produits électroniques', 'Tous les produits électroniques ZEN bénéficient d''une garantie constructeur de 12 mois couvrant les défauts de fabrication, hors casse et oxydation.', 'garantie', 'publie', '22222222-2222-2222-2222-222222222222'),
  ('Modifier une commande en préparation', 'Une commande peut être modifiée (adresse, quantité) uniquement si elle est encore au statut "en préparation". Contactez le support avec le numéro de commande.', 'commandes', 'publie', '22222222-2222-2222-2222-222222222222'),
  ('Paiement à la livraison', 'Le paiement à la livraison (COD) est disponible pour toutes les zones desservies en Tunisie, sans frais supplémentaires.', 'paiement', 'publie', '22222222-2222-2222-2222-222222222222'),
  ('Casque audio ZEN X1 — compatibilité', 'Le casque ZEN X1 est compatible Bluetooth 5.2 avec tous les appareils iOS et Android. L''autonomie est de 30h en lecture continue.', 'produits', 'publie', '22222222-2222-2222-2222-222222222222'),
  ('Suivi de colis introuvable', 'Si le numéro de suivi ne fonctionne pas sous 48h après l''email d''expédition, il peut s''agir d''un délai de synchronisation avec le transporteur. Escaladez si le délai dépasse 72h.', 'livraison', 'brouillon', '11111111-1111-1111-1111-111111111111');

-- Conversations de démonstration
insert into conversations (id, customer_id, order_id, channel, status, sentiment, language, urgency_score, priority, assigned_agent_id, created_at) values
  ('c1111111-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'a1111111-0000-0000-0000-000000000001', 'web', 'nouveau', 'neutre', 'fr', 0.3, 12.5, null, now() - interval '25 minutes'),
  ('c1111111-0000-0000-0000-000000000002', '44444444-4444-4444-4444-444444444444', 'a1111111-0000-0000-0000-000000000002', 'whatsapp', 'en_cours', 'negatif', 'ar', 0.7, 38.0, '11111111-1111-1111-1111-111111111111', now() - interval '2 hours'),
  ('c1111111-0000-0000-0000-000000000003', '55555555-5555-5555-5555-555555555555', null, 'email', 'escalade', 'colere', 'fr', 0.95, 91.0, '11111111-1111-1111-1111-111111111111', now() - interval '6 hours');

insert into messages (conversation_id, author_type, content, created_at) values
  ('c1111111-0000-0000-0000-000000000001', 'client', 'Bonjour, ma commande CMD-10234 est-elle bien expédiée ?', now() - interval '25 minutes'),
  ('c1111111-0000-0000-0000-000000000002', 'client', 'لم يصل طردي رقم CMD-10255 بعد ومر أسبوع، أريد توضيح', now() - interval '2 hours'),
  ('c1111111-0000-0000-0000-000000000003', 'client', 'C''est la troisième fois que j''écris, toujours aucune réponse sur ma commande CMD-99999 qui n''existe même pas dans votre système !', now() - interval '6 hours');

insert into escalations (conversation_id, reason, status) values
  ('c1111111-0000-0000-0000-000000000003', 'colere_client', 'ouverte');
