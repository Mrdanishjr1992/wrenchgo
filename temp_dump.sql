SET session_replication_role = replica;

--
-- PostgreSQL database dump
--

-- \restrict qJ1j2zRFVMF84E4a6N3kf1fNAh5siVtVyULbAm8QIdsGJ3iGce39es36DLq5ULs

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: audit_log_entries; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: flow_state; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: users; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: identities; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: instances; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_clients; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: sessions; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: mfa_amr_claims; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: mfa_factors; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: mfa_challenges; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_authorizations; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_client_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_consents; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: one_time_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: sso_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: saml_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: saml_relay_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: sso_domains; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: badges; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: vehicles; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: jobs; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: badge_history; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: messages; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: chat_attachments; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: chat_lifecycle_config; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: chat_restrictions; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: customer_payment_methods; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: symptoms; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: education_cards; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: service_hubs; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."service_hubs" ("id", "name", "slug", "zip", "lat", "lng", "max_radius_miles", "active_radius_miles", "is_active", "invite_only", "launch_date", "settings", "created_at") VALUES
	('c354c5fe-fc9a-41b4-9df7-a0c7e3a5d813', 'Chicago', 'chicago', '60453', 41.720000, -87.740000, 100, 50, true, true, NULL, '{}', '2026-01-11 10:11:10.050301+00');


--
-- Data for Name: launch_metrics; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."launch_metrics" ("id", "hub_id", "date", "active_mechanics", "new_mechanics", "jobs_requested", "jobs_completed", "median_response_minutes", "completion_rate", "jobs_per_mechanic", "complaints", "no_shows") VALUES
	('8ec8a97a-5ebf-4614-a8f0-10bef5f96213', 'c354c5fe-fc9a-41b4-9df7-a0c7e3a5d813', '2026-01-11', 0, 0, 0, 0, NULL, NULL, NULL, 0, 0);


--
-- Data for Name: mechanic_profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: safety_measures; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: mechanic_safety; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: skills; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: mechanic_skills; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: mechanic_stripe_accounts; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: tools; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: mechanic_tools; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: media_assets; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: message_audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: payments; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: preferred_mechanics; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: quote_requests; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: quotes; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: reviews; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: review_media; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: review_reports; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: skill_verifications; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: support_requests; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: symptom_education; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: symptom_mappings; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: symptom_questions; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: trust_scores; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: user_badges; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: user_rating_prompt_state; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: user_violations; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: buckets; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

INSERT INTO "storage"."buckets" ("id", "name", "owner", "created_at", "updated_at", "public", "avif_autodetection", "file_size_limit", "allowed_mime_types", "owner_id", "type") VALUES
	('identity-docs', 'identity-docs', NULL, '2026-01-02 14:05:55.107371+00', '2026-01-02 14:05:55.107371+00', false, false, 5242880, '{image/jpeg,image/jpg,image/png,image/webp}', NULL, 'STANDARD'),
	('media', 'media', NULL, '2026-01-06 01:53:33.350996+00', '2026-01-06 01:53:33.350996+00', true, false, 52428800, NULL, NULL, 'STANDARD'),
	('avatars', 'avatars', NULL, '2026-01-04 03:04:37.841807+00', '2026-01-04 03:04:37.841807+00', true, false, 5242880, '{image/jpeg,image/png,image/webp,image/gif}', NULL, 'STANDARD'),
	('vehicle-images', 'vehicle-images', NULL, '2026-01-11 10:07:25.354833+00', '2026-01-11 10:07:25.354833+00', false, false, 10485760, '{image/jpeg,image/png,image/webp}', NULL, 'STANDARD'),
	('job-images', 'job-images', NULL, '2026-01-11 10:07:25.354833+00', '2026-01-11 10:07:25.354833+00', false, false, 10485760, '{image/jpeg,image/png,image/webp}', NULL, 'STANDARD'),
	('review-media', 'review-media', NULL, '2026-01-11 10:07:25.354833+00', '2026-01-11 10:07:25.354833+00', false, false, 10485760, '{image/jpeg,image/png,image/webp,video/mp4}', NULL, 'STANDARD'),
	('chat-attachments', 'chat-attachments', NULL, '2026-01-10 09:10:09.157817+00', '2026-01-10 09:10:09.157817+00', false, false, 10485760, '{image/jpeg,image/png,image/webp,application/pdf}', NULL, 'STANDARD'),
	('support-screenshots', 'support-screenshots', NULL, '2026-01-08 21:40:17.046486+00', '2026-01-08 21:40:17.046486+00', false, false, 10485760, '{image/jpeg,image/png,image/webp}', NULL, 'STANDARD');


--
-- Data for Name: buckets_analytics; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: buckets_vectors; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: objects; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

INSERT INTO "storage"."objects" ("id", "bucket_id", "name", "owner", "created_at", "updated_at", "last_accessed_at", "metadata", "version", "owner_id", "user_metadata", "level") VALUES
	('9c584f4d-3751-42e2-b634-ee09c202f9a5', 'media', 'wrenchGoAd2.mp4', NULL, '2026-01-06 01:59:58.692746+00', '2026-01-06 01:59:58.692746+00', '2026-01-06 01:59:58.692746+00', '{"eTag": "\"7ac3f322cbab5f783fefa93638c4036e-1\"", "size": 3127742, "mimetype": "video/mp4", "cacheControl": "max-age=3600", "lastModified": "2026-01-06T01:59:59.000Z", "contentLength": 3127742, "httpStatusCode": 200}', '1dcb2651-e76b-4767-8b50-7baf4c5ad98d', NULL, NULL, 1),
	('554afec1-ad4f-414e-a781-38da2684b9ea', 'media', 'wrenchGoAd3.mp4', NULL, '2026-01-06 02:00:01.111743+00', '2026-01-06 02:00:01.111743+00', '2026-01-06 02:00:01.111743+00', '{"eTag": "\"d5be7639d2e4038f82a3ce11b781b7f2-1\"", "size": 5018141, "mimetype": "video/mp4", "cacheControl": "max-age=3600", "lastModified": "2026-01-06T02:00:01.000Z", "contentLength": 5018141, "httpStatusCode": 200}', 'e8ac068b-a668-453e-a496-95efc037fdfe', NULL, NULL, 1),
	('8794dcd6-d24a-445f-b6c4-fa51492db82d', 'media', 'logovideo.mp4', NULL, '2026-01-06 01:59:35.728972+00', '2026-01-06 02:00:17.397812+00', '2026-01-06 01:59:35.728972+00', '{"eTag": "\"ef6a920b6e4792a1e8fd500d5e9c04d0\"", "size": 1741810, "mimetype": "video/mp4", "cacheControl": "max-age=3600", "lastModified": "2026-01-06T02:00:18.000Z", "contentLength": 1741810, "httpStatusCode": 200}', 'a66e091e-188b-484d-80a1-2110b236c526', NULL, NULL, 1),
	('01bc76bc-3a9e-4124-8c75-76b0a0bb9e36', 'avatars', 'avatars/4d314a6a-ab4c-4409-b6bd-d870ef3b98c3.png', '4d314a6a-ab4c-4409-b6bd-d870ef3b98c3', '2026-01-06 04:16:48.234609+00', '2026-01-06 04:16:48.234609+00', '2026-01-06 04:16:48.234609+00', '{"eTag": "\"1758778b5f4a9ac77ae62b9abfa2b460\"", "size": 267370, "mimetype": "image/png", "cacheControl": "max-age=3600", "lastModified": "2026-01-06T04:16:49.000Z", "contentLength": 267370, "httpStatusCode": 200}', '0ff2ceb0-8275-4aad-b35c-3f2e87960190', '4d314a6a-ab4c-4409-b6bd-d870ef3b98c3', '{}', 2),
	('705560c5-b6b2-400b-8b4f-d7f05ff89812', 'media', 'wrenchGoAd4.mp4', NULL, '2026-01-06 01:59:57.683061+00', '2026-01-07 23:19:55.70169+00', '2026-01-06 01:59:57.683061+00', '{"eTag": "\"51e4d82e9671e7ed8a7955ca01707838\"", "size": 2105474, "mimetype": "video/mp4", "cacheControl": "max-age=3600", "lastModified": "2026-01-07T23:19:56.000Z", "contentLength": 2105474, "httpStatusCode": 200}', 'be0dc4a3-b59b-46e5-80a8-900f8c250d5c', NULL, NULL, 1),
	('b9fb5fcf-0187-430f-a8d9-de3cb2052d78', 'media', 'wrenchGoAd.mp4', NULL, '2026-01-07 23:19:38.985881+00', '2026-01-07 23:20:01.09114+00', '2026-01-07 23:19:38.985881+00', '{"eTag": "\"52bd92e1ccca06abdf7cee98130ab419\"", "size": 17740985, "mimetype": "video/mp4", "cacheControl": "max-age=3600", "lastModified": "2026-01-07T23:20:01.000Z", "contentLength": 17740985, "httpStatusCode": 200}', '6ed9335c-8f5f-488b-a8fa-c611d139502b', NULL, NULL, 1),
	('732db601-1098-4cc8-b58c-f1e258210305', 'avatars', 'avatars/ce7d2a53-4f35-46a9-b1c9-5a53b39f95f9.jpeg', 'ce7d2a53-4f35-46a9-b1c9-5a53b39f95f9', '2026-01-08 03:02:29.923478+00', '2026-01-08 03:02:29.923478+00', '2026-01-08 03:02:29.923478+00', '{"eTag": "\"4d505dc515b2a60fb384ef55262dbef1\"", "size": 126139, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-01-08T03:02:30.000Z", "contentLength": 126139, "httpStatusCode": 200}', '9a450ad0-177e-488d-9359-01d550f1ef60', 'ce7d2a53-4f35-46a9-b1c9-5a53b39f95f9', '{}', 2),
	('924a3e20-696e-4625-b636-92fe8c100772', 'chat-attachments', '77af6527-40da-4f6b-81f4-4779d39c3bfa/1768037625147.jpeg', '77af6527-40da-4f6b-81f4-4779d39c3bfa', '2026-01-10 09:33:45.726021+00', '2026-01-10 09:33:45.726021+00', '2026-01-10 09:33:45.726021+00', '{"eTag": "\"2a8d916bbd490bb0270bb9d96a4b0cce\"", "size": 101153, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-01-10T09:33:46.000Z", "contentLength": 101153, "httpStatusCode": 200}', '71606af1-8211-4a68-8f6a-e0d93adc2596', '77af6527-40da-4f6b-81f4-4779d39c3bfa', '{}', 2),
	('39534c74-5f92-4812-b29b-4e552aaf2c34', 'chat-attachments', '77af6527-40da-4f6b-81f4-4779d39c3bfa/1768037651625.jpeg', '77af6527-40da-4f6b-81f4-4779d39c3bfa', '2026-01-10 09:34:12.166599+00', '2026-01-10 09:34:12.166599+00', '2026-01-10 09:34:12.166599+00', '{"eTag": "\"9d8a33f8a8128ea01a6a7dd76086c185\"", "size": 48652, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-01-10T09:34:13.000Z", "contentLength": 48652, "httpStatusCode": 200}', '685825b9-30eb-489e-85c2-bb8da672e526', '77af6527-40da-4f6b-81f4-4779d39c3bfa', '{}', 2),
	('77c49800-1b1b-4925-b56f-113a2053d590', 'chat-attachments', '77af6527-40da-4f6b-81f4-4779d39c3bfa/1768038003579.jpeg', '77af6527-40da-4f6b-81f4-4779d39c3bfa', '2026-01-10 09:40:04.912671+00', '2026-01-10 09:40:04.912671+00', '2026-01-10 09:40:04.912671+00', '{"eTag": "\"2b38bc99114d414b0b80a4d8292db164\"", "size": 944331, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-01-10T09:40:05.000Z", "contentLength": 944331, "httpStatusCode": 200}', 'ca4d3b7f-ea87-442e-9bb0-4431f1bba317', '77af6527-40da-4f6b-81f4-4779d39c3bfa', '{}', 2),
	('e235d851-4a26-41e9-a65f-9100414cc11b', 'chat-attachments', '77af6527-40da-4f6b-81f4-4779d39c3bfa/1768038054163.jpeg', '77af6527-40da-4f6b-81f4-4779d39c3bfa', '2026-01-10 09:40:55.543842+00', '2026-01-10 09:40:55.543842+00', '2026-01-10 09:40:55.543842+00', '{"eTag": "\"0636c608c04144f1ea6a66a8c406672c\"", "size": 1480379, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-01-10T09:40:56.000Z", "contentLength": 1480379, "httpStatusCode": 200}', '63d45d6d-6059-4950-91c9-3fec0ed542e7', '77af6527-40da-4f6b-81f4-4779d39c3bfa', '{}', 2),
	('5cbd507e-50b3-4fec-ae43-c2c605d42549', 'avatars', 'avatars/77af6527-40da-4f6b-81f4-4779d39c3bfa.jpeg', '77af6527-40da-4f6b-81f4-4779d39c3bfa', '2026-01-10 11:46:46.504324+00', '2026-01-10 11:46:46.504324+00', '2026-01-10 11:46:46.504324+00', '{"eTag": "\"3a62323c7c93d18b3d92ab4d49b368dc\"", "size": 960423, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-01-10T11:46:47.000Z", "contentLength": 960423, "httpStatusCode": 200}', '872dfcbf-9fcb-4cc6-a6b9-3e9335c3a6ba', '77af6527-40da-4f6b-81f4-4779d39c3bfa', '{}', 2),
	('8ab8e772-44b2-404c-b3c3-8e516e675310', 'avatars', 'avatars/b6aed78c-b5b7-419a-8697-7141f77a4a8e.jpeg', 'b6aed78c-b5b7-419a-8697-7141f77a4a8e', '2026-01-10 11:48:23.495738+00', '2026-01-10 11:48:23.495738+00', '2026-01-10 11:48:23.495738+00', '{"eTag": "\"1a6a53caf119b933822ff3be09b3fb10\"", "size": 94793, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-01-10T11:48:24.000Z", "contentLength": 94793, "httpStatusCode": 200}', 'c97026df-8f1a-48f2-a465-e9c8ebf986ff', 'b6aed78c-b5b7-419a-8697-7141f77a4a8e', '{}', 2);


--
-- Data for Name: prefixes; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

INSERT INTO "storage"."prefixes" ("bucket_id", "name", "created_at", "updated_at") VALUES
	('avatars', 'avatars', '2026-01-06 04:16:48.234609+00', '2026-01-06 04:16:48.234609+00'),
	('chat-attachments', '77af6527-40da-4f6b-81f4-4779d39c3bfa', '2026-01-10 09:33:45.726021+00', '2026-01-10 09:33:45.726021+00');


--
-- Data for Name: s3_multipart_uploads; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: s3_multipart_uploads_parts; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: vector_indexes; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: hooks; Type: TABLE DATA; Schema: supabase_functions; Owner: supabase_functions_admin
--



--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE SET; Schema: auth; Owner: supabase_auth_admin
--

SELECT pg_catalog.setval('"auth"."refresh_tokens_id_seq"', 278, true);


--
-- Name: hooks_id_seq; Type: SEQUENCE SET; Schema: supabase_functions; Owner: supabase_functions_admin
--

SELECT pg_catalog.setval('"supabase_functions"."hooks_id_seq"', 1, false);


--
-- PostgreSQL database dump complete
--

-- \unrestrict qJ1j2zRFVMF84E4a6N3kf1fNAh5siVtVyULbAm8QIdsGJ3iGce39es36DLq5ULs

RESET ALL;
