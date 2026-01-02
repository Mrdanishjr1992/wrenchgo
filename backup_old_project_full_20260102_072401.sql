


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."job_status" AS ENUM (
    'searching',
    'quoted',
    'accepted',
    'in_progress',
    'completed',
    'cancelled'
);


ALTER TYPE "public"."job_status" OWNER TO "postgres";


CREATE TYPE "public"."quote_request_status" AS ENUM (
    'pending',
    'accepted',
    'rejected',
    'expired',
    'cancelled'
);


ALTER TYPE "public"."quote_request_status" OWNER TO "postgres";


CREATE TYPE "public"."quote_status" AS ENUM (
    'pending',
    'accepted',
    'rejected',
    'expired',
    'canceled_by_customer',
    'canceled_by_mechanic'
);


ALTER TYPE "public"."quote_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."block_blocklisted_email_signup"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_is_blocked boolean := false;
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'email_blocklist'
  ) then
    select exists (
      select 1
      from public.email_blocklist b
      where lower(b.email) = lower(new.email)
        and b.unblocked_at is null
        and b.can_reapply = false
    )
    into v_is_blocked;

    if v_is_blocked then
      raise exception 'This email address is not eligible for registration. Please contact support.';
    end if;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."block_blocklisted_email_signup"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."block_deleted_profile_access"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_deleted_at timestamptz;
begin
  select p.deleted_at
    into v_deleted_at
  from public.profiles p
  where p.id = new.id
     or p.auth_id = new.id
  limit 1;

  if v_deleted_at is not null then
    raise exception 'This account has been deleted and cannot be accessed. Contact support for reactivation.';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."block_deleted_profile_access"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cancel_quote_by_customer"("p_quote_id" "uuid", "p_reason" "text", "p_note" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  v_customer_id uuid;
  v_quote record;
  v_job record;
  v_now timestamptz := now();
  v_minutes_since_acceptance numeric;
  v_minutes_until_arrival numeric;
  v_cancellation_fee_cents integer := 0;
  v_can_cancel boolean := true;
  v_error_message text := NULL;
  v_warning_message text := NULL;
BEGIN
  -- Get the authenticated user ID
  v_customer_id := auth.uid();
  
  IF v_customer_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Not authenticated'
    );
  END IF;

  -- Validate reason is provided
  IF p_reason IS NULL OR p_reason = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Cancellation reason is required'
    );
  END IF;

  -- Validate reason is one of the allowed values
  IF p_reason NOT IN (
    'found_other_mechanic',
    'issue_resolved',
    'wrong_vehicle',
    'too_expensive',
    'scheduled_conflict',
    'other'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid cancellation reason'
    );
  END IF;

  -- If reason is "other", note is required
  IF p_reason = 'other' AND (p_note IS NULL OR p_note = '') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Please provide details for "other" reason'
    );
  END IF;

  -- Load quote with job information
  SELECT 
    qr.*,
    j.customer_id as job_customer_id,
    j.status as job_status,
    j.accepted_mechanic_id
  INTO v_quote
  FROM quote_requests qr
  JOIN jobs j ON j.id = qr.job_id
  WHERE qr.id = p_quote_id;

  -- Check if quote exists
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Quote not found'
    );
  END IF;

  -- Verify the caller is the job's customer
  IF v_quote.job_customer_id != v_customer_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'You can only cancel your own quotes'
    );
  END IF;

  -- Load job details
  SELECT * INTO v_job
  FROM jobs
  WHERE id = v_quote.job_id;

  -- Check if job is already completed
  IF v_job.status = 'completed' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Cannot cancel a completed job'
    );
  END IF;

  -- Check if job is already canceled
  IF v_job.status = 'canceled' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'This job is already canceled'
    );
  END IF;

  -- Check if quote is in a cancelable state
  IF v_quote.status NOT IN ('accepted', 'quoted') THEN
    IF v_quote.status LIKE 'canceled_%' THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'This quote is already canceled'
      );
    ELSE
      RETURN jsonb_build_object(
        'success', false,
        'error', 'This quote cannot be canceled in its current state'
      );
    END IF;
  END IF;

  -- Only allow cancellation if this quote is the accepted one
  IF v_quote.status = 'accepted' OR v_job.accepted_mechanic_id = v_quote.mechanic_id THEN
    -- Calculate time since acceptance
    IF v_quote.accepted_at IS NOT NULL THEN
      v_minutes_since_acceptance := EXTRACT(EPOCH FROM (v_now - v_quote.accepted_at)) / 60;
    ELSE
      -- Fallback to updated_at if accepted_at is not set
      v_minutes_since_acceptance := EXTRACT(EPOCH FROM (v_now - v_quote.updated_at)) / 60;
    END IF;

    -- RULE 1: Free cancellation within 5 minutes of acceptance
    IF v_minutes_since_acceptance <= 5 THEN
      v_cancellation_fee_cents := 0;
      v_warning_message := 'Canceled within free cancellation window (5 minutes)';
    
    -- RULE 2: Job is in progress - require reason and apply fee
    ELSIF v_job.status = 'in_progress' THEN
      v_cancellation_fee_cents := 2500; -- $25 fee
      v_warning_message := 'Cancellation fee applied: mechanic has started work';
    
    -- RULE 3: Check if cancellation is within 60 minutes of scheduled arrival
    ELSIF v_quote.proposed_time_text IS NOT NULL THEN
      -- Try to parse arrival time (this is a simplified check)
      -- In production, you'd want more robust time parsing
      -- For now, we'll apply a fee if there's a proposed time and it's been > 5 minutes
      IF v_minutes_since_acceptance > 5 THEN
        v_cancellation_fee_cents := 1500; -- $15 fee
        v_warning_message := 'Cancellation fee applied: close to scheduled arrival time';
      END IF;
    
    -- RULE 4: After 5 minutes but no special circumstances - require reason, no fee
    ELSE
      v_cancellation_fee_cents := 0;
      v_warning_message := 'Cancellation allowed with reason';
    END IF;

  ELSE
    -- Quote is not accepted, can cancel freely
    v_cancellation_fee_cents := 0;
  END IF;

  -- Perform the cancellation in a transaction
  BEGIN
    -- Update the quote
    UPDATE quote_requests
    SET 
      status = 'canceled_by_customer',
      canceled_at = v_now,
      canceled_by = 'customer',
      cancel_reason = p_reason,
      cancel_note = p_note,
      cancellation_fee_cents = v_cancellation_fee_cents,
      updated_at = v_now
    WHERE id = p_quote_id;

    -- If this was the accepted quote, update the job status
    IF v_quote.status = 'accepted' OR v_job.accepted_mechanic_id = v_quote.mechanic_id THEN
      UPDATE jobs
      SET 
        status = 'canceled',
        canceled_at = v_now,
        canceled_by = 'customer',
        accepted_mechanic_id = NULL,
        updated_at = v_now
      WHERE id = v_quote.job_id;
    END IF;

    -- Return success with details
    RETURN jsonb_build_object(
      'success', true,
      'quote_id', p_quote_id,
      'job_id', v_quote.job_id,
      'cancellation_fee_cents', v_cancellation_fee_cents,
      'warning', v_warning_message,
      'message', 'Quote canceled successfully'
    );

  EXCEPTION WHEN OTHERS THEN
    -- Rollback happens automatically
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Failed to cancel quote: ' || SQLERRM
    );
  END;
END;
$_$;


ALTER FUNCTION "public"."cancel_quote_by_customer"("p_quote_id" "uuid", "p_reason" "text", "p_note" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."cancel_quote_by_customer"("p_quote_id" "uuid", "p_reason" "text", "p_note" "text") IS 'Allows customers to cancel accepted quotes with time-protection rules:
- Free cancellation within 5 minutes of acceptance
- Fee applied if job is in_progress or close to arrival time
- Requires cancellation reason
- Updates both quote and job status atomically';



CREATE OR REPLACE FUNCTION "public"."check_email_not_blocked"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  is_blocked BOOLEAN;
BEGIN
  -- Check if email_blocklist table exists
  IF EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'email_blocklist'
  ) THEN
    -- Check if email is in blocklist
    SELECT EXISTS (
      SELECT 1 FROM email_blocklist
      WHERE email = NEW.email
      AND unblocked_at IS NULL
      AND can_reapply = false
    ) INTO is_blocked;

    IF is_blocked THEN
      RAISE EXCEPTION 'This email address is not eligible for registration. Please contact support.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_email_not_blocked"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_user_not_deleted"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  profile_deleted_at timestamptz;
begin
  -- Check profile by auth_id (preferred) OR id (fallback)
  select p.deleted_at
    into profile_deleted_at
  from public.profiles p
  where p.auth_id = new.id
     or p.id = new.id
  limit 1;

  if profile_deleted_at is not null then
    raise exception 'This account has been deleted and cannot be accessed. Contact support for reactivation.';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."check_user_not_deleted"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_public_profile_card"("user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  result jsonb;
  profile_data jsonb;
  ratings_data jsonb;
  badges_data jsonb;
  skills_data jsonb;
  user_role text;
BEGIN
  -- Fetch basic profile (public fields only)
  SELECT jsonb_build_object(
    'id', p.id,
    'display_name', COALESCE(p.display_name, p.full_name),
    'photo_url', p.photo_url,
    'city', p.city,
    'service_area', p.service_area,
    'bio', p.bio,
    'is_available', p.is_available,
    'created_at', p.created_at
  ), COALESCE(p.role, 'customer')
  INTO profile_data, user_role
  FROM profiles p
  WHERE p.id = user_id
    AND p.deleted_at IS NULL;

  -- Return null if profile not found
  IF profile_data IS NULL THEN
    RETURN NULL;
  END IF;

  -- Add role to profile data
  profile_data := profile_data || jsonb_build_object('role', user_role);

  -- Fetch ratings (if exists)
  SELECT jsonb_build_object(
    'overall_avg', COALESCE(ur.overall_avg, 0),
    'performance_avg', COALESCE(ur.performance_avg, 0),
    'timing_avg', COALESCE(ur.timing_avg, 0),
    'cost_avg', COALESCE(ur.cost_avg, 0),
    'review_count', COALESCE(ur.review_count, 0)
  )
  INTO ratings_data
  FROM user_ratings ur
  WHERE ur.user_id = user_id;

  -- Default ratings if none exist
  IF ratings_data IS NULL THEN
    ratings_data := jsonb_build_object(
      'overall_avg', 0,
      'performance_avg', 0,
      'timing_avg', 0,
      'cost_avg', 0,
      'review_count', 0
    );
  END IF;

  -- Fetch active badges
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', ub.id,
      'badge_id', ub.badge_id,
      'awarded_at', ub.awarded_at,
      'badge', jsonb_build_object(
        'code', b.code,
        'title', b.title,
        'description', b.description,
        'icon', b.icon,
        'badge_type', b.badge_type
      )
    )
    ORDER BY ub.awarded_at DESC
  )
  INTO badges_data
  FROM user_badges ub
  INNER JOIN badges b ON b.id = ub.badge_id
  WHERE ub.user_id = user_id
    AND (ub.expires_at IS NULL OR ub.expires_at > NOW());

  -- Default empty array if no badges
  IF badges_data IS NULL THEN
    badges_data := '[]'::jsonb;
  END IF;

  -- Fetch skills (mechanic only)
  IF user_role = 'mechanic' THEN
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', ms.id,
        'level', ms.level,
        'years_experience', ms.years_experience,
        'is_verified', ms.is_verified,
        'skill', jsonb_build_object(
          'id', s.id,
          'name', s.name,
          'category', s.category,
          'description', s.description
        )
      )
      ORDER BY ms.is_verified DESC, ms.level DESC
    )
    INTO skills_data
    FROM mechanic_skills ms
    INNER JOIN skills s ON s.id = ms.skill_id
    WHERE ms.mechanic_id = user_id;

    IF skills_data IS NULL THEN
      skills_data := '[]'::jsonb;
    END IF;
  ELSE
    skills_data := '[]'::jsonb;
  END IF;

  -- Combine all data
  result := profile_data || jsonb_build_object(
    'ratings', ratings_data,
    'badges', badges_data,
    'skills', skills_data
  );

  RETURN result;
END;
$$;


ALTER FUNCTION "public"."get_public_profile_card"("user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_public_profile_card"("user_id" "uuid") IS 'Returns public profile card data for display in quotes flow. Only safe, public fields are returned.';



CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.profiles (
    auth_id,
    email,
    full_name,
    created_at,
    updated_at
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    now(),
    now()
  )
  on conflict (auth_id) do nothing;

  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."education_cards" (
    "symptom_key" "text" NOT NULL,
    "card_key" "text" NOT NULL,
    "title" "text",
    "summary" "text",
    "why_it_happens" "text",
    "what_we_check" "text",
    "is_it_safe" "text",
    "prep_before_visit" "text",
    "quote_expectation" "text",
    "red_flags" "text",
    "order_index" integer,
    "id" "uuid" NOT NULL
);


ALTER TABLE "public"."education_cards" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "accepted_mechanic_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "symptom_id" "uuid",
    "location_lat" numeric(10,8),
    "location_lng" numeric(11,8),
    "location_address" "text",
    "status" "public"."job_status" DEFAULT 'searching'::"public"."job_status" NOT NULL,
    "scheduled_for" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "vehicle_id" "uuid",
    "canceled_at" timestamp with time zone,
    "canceled_by" "text",
    "preferred_time" "text",
    CONSTRAINT "jobs_canceled_by_check" CHECK (("canceled_by" = ANY (ARRAY['customer'::"text", 'mechanic'::"text", 'system'::"text"])))
);


ALTER TABLE "public"."jobs" OWNER TO "postgres";


COMMENT ON COLUMN "public"."jobs"."canceled_at" IS 'Timestamp when the job was canceled';



COMMENT ON COLUMN "public"."jobs"."canceled_by" IS 'Who canceled the job: customer, mechanic, or system';



CREATE TABLE IF NOT EXISTS "public"."mechanic_profiles" (
    "id" "uuid" NOT NULL,
    "business_name" "text",
    "bio" "text",
    "years_experience" integer,
    "service_radius_km" integer DEFAULT 50,
    "base_location_lat" numeric(10,8),
    "base_location_lng" numeric(11,8),
    "is_available" boolean DEFAULT true,
    "jobs_completed" integer DEFAULT 0,
    "average_rating" numeric(3,2) DEFAULT 0.00,
    "total_reviews" integer DEFAULT 0,
    "is_verified" boolean DEFAULT false,
    "verified_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."mechanic_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "recipient_id" "uuid"
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "auth_id" "uuid",
    "full_name" "text",
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    "deleted_reason" "text",
    "deletion_requested_by" "uuid",
    "can_reapply" boolean DEFAULT false,
    "reapplication_notes" "text",
    "id_photo_path" "text",
    "id_status" "text" DEFAULT 'none'::"text",
    "id_uploaded_at" timestamp with time zone,
    "id_verified_at" timestamp with time zone,
    "id_rejected_reason" "text",
    "id_verified_by" "uuid",
    "email" "text",
    "role" "text" DEFAULT 'customer'::"text",
    "phone" "text",
    CONSTRAINT "profiles_id_status_check" CHECK (("id_status" = ANY (ARRAY['none'::"text", 'pending'::"text", 'verified'::"text", 'rejected'::"text"]))),
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['customer'::"text", 'mechanic'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."profiles"."id_photo_path" IS 'Storage path to identity document (not public URL)';



COMMENT ON COLUMN "public"."profiles"."id_status" IS 'Verification status: none, pending, verified, rejected';



COMMENT ON COLUMN "public"."profiles"."id_uploaded_at" IS 'When user uploaded their ID';



COMMENT ON COLUMN "public"."profiles"."id_verified_at" IS 'When admin verified the ID';



COMMENT ON COLUMN "public"."profiles"."id_rejected_reason" IS 'Reason for rejection (shown to user)';



COMMENT ON COLUMN "public"."profiles"."id_verified_by" IS 'Admin user who verified/rejected the ID';



CREATE TABLE IF NOT EXISTS "public"."quote_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "mechanic_id" "uuid" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "price_cents" integer NOT NULL,
    "estimated_hours" numeric(5,2),
    "notes" "text",
    "status" "public"."quote_request_status" DEFAULT 'pending'::"public"."quote_request_status" NOT NULL,
    "accepted_at" timestamp with time zone,
    "rejected_at" timestamp with time zone,
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "canceled_at" timestamp with time zone,
    "canceled_by" "text",
    "cancel_reason" "text",
    "cancel_note" "text",
    "cancellation_fee_cents" integer,
    CONSTRAINT "quote_requests_canceled_by_check" CHECK (("canceled_by" = ANY (ARRAY['customer'::"text", 'mechanic'::"text", 'system'::"text"]))),
    CONSTRAINT "quote_requests_cancellation_fee_cents_check" CHECK (("cancellation_fee_cents" >= 0))
);


ALTER TABLE "public"."quote_requests" OWNER TO "postgres";


COMMENT ON COLUMN "public"."quote_requests"."accepted_at" IS 'Timestamp when the quote was accepted (for time-protection calculations)';



COMMENT ON COLUMN "public"."quote_requests"."canceled_at" IS 'Timestamp when the quote was canceled';



COMMENT ON COLUMN "public"."quote_requests"."canceled_by" IS 'Who canceled the quote: customer, mechanic, or system';



COMMENT ON COLUMN "public"."quote_requests"."cancel_reason" IS 'Reason code for cancellation (e.g., found_other_mechanic, issue_resolved)';



COMMENT ON COLUMN "public"."quote_requests"."cancel_note" IS 'Optional free-text note explaining cancellation';



COMMENT ON COLUMN "public"."quote_requests"."cancellation_fee_cents" IS 'Cancellation fee in cents (if applicable based on timing rules)';



CREATE TABLE IF NOT EXISTS "public"."quotes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "mechanic_id" "uuid" NOT NULL,
    "price_cents" integer NOT NULL,
    "estimated_hours" numeric(5,2),
    "notes" "text",
    "status" "public"."quote_status" DEFAULT 'pending'::"public"."quote_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."quotes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."safety_measures" (
    "key" "text" NOT NULL,
    "label" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."safety_measures" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."skills" (
    "key" "text" NOT NULL,
    "label" "text" NOT NULL,
    "category" "text",
    "is_mobile_safe" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."skills" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."symptom_education" (
    "symptom_key" "text" NOT NULL,
    "title" "text" NOT NULL,
    "summary" "text" NOT NULL,
    "is_it_safe" "text" NOT NULL,
    "what_we_check" "text" NOT NULL,
    "how_quotes_work" "text" NOT NULL
);


ALTER TABLE "public"."symptom_education" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."symptom_mappings" (
    "symptom_key" "text" NOT NULL,
    "symptom_label" "text" NOT NULL,
    "category" "text" NOT NULL,
    "required_skill_keys" "text"[] DEFAULT '{}'::"text"[],
    "suggested_tool_keys" "text"[] DEFAULT '{}'::"text"[],
    "required_safety_keys" "text"[] DEFAULT '{}'::"text"[],
    "quote_strategy" "text" DEFAULT 'diagnosis-first'::"text",
    "risk_level" "text" DEFAULT 'low'::"text",
    "customer_explainer" "text",
    "mechanic_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "id" "uuid" NOT NULL,
    CONSTRAINT "symptom_mappings_category_check" CHECK (("category" = ANY (ARRAY['Engine'::"text", 'Engine Performance'::"text", 'Engine & Fuel'::"text", 'Fuel System'::"text", 'Transmission'::"text", 'Drivetrain'::"text", 'Brakes'::"text", 'Brake System'::"text", 'Electrical'::"text", 'Electrical & Charging'::"text", 'Battery'::"text", 'Cooling System'::"text", 'Cooling'::"text", 'Suspension'::"text", 'Steering'::"text", 'Steering & Suspension'::"text", 'Suspension & Steering'::"text", 'HVAC'::"text", 'Climate Control'::"text", 'Air Conditioning'::"text", 'Exhaust'::"text", 'Exhaust & Emissions'::"text", 'Emissions'::"text", 'Tires'::"text", 'Wheels'::"text", 'Tires & Wheels'::"text", 'Wheels & Tires'::"text", 'Lights'::"text", 'Lighting'::"text", 'Body'::"text", 'Interior'::"text", 'Maintenance'::"text", 'General Maintenance'::"text", 'Safety'::"text", 'Safety Systems'::"text", 'Other'::"text", 'Unknown'::"text"]))),
    CONSTRAINT "symptom_mappings_quote_strategy_check" CHECK (("quote_strategy" = ANY (ARRAY['diagnosis-first'::"text", 'diagnostic_only'::"text", 'inspection_required'::"text", 'fixed_simple'::"text"])))
);


ALTER TABLE "public"."symptom_mappings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."symptom_question_options" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "question_id" "uuid",
    "label" "text" NOT NULL,
    "order_index" integer NOT NULL
);


ALTER TABLE "public"."symptom_question_options" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."symptom_questions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "symptom_key" "text" NOT NULL,
    "question_key" "text" NOT NULL,
    "question_text" "text" NOT NULL,
    "question_type" "text" NOT NULL,
    "options" "jsonb",
    "affects_safety" boolean DEFAULT false,
    "affects_quote" boolean DEFAULT false,
    "display_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "affects_tools" boolean DEFAULT false
);


ALTER TABLE "public"."symptom_questions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."symptom_refinements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "symptom_key" "text" NOT NULL,
    "question_key" "text" NOT NULL,
    "match_type" "text" NOT NULL,
    "match_value" "jsonb",
    "override_category" "text",
    "override_risk_level" "text",
    "override_quote_strategy" "text",
    "priority" integer DEFAULT 100 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "symptom_refinements_match_type_check" CHECK (("match_type" = ANY (ARRAY['equals'::"text", 'in'::"text", 'contains'::"text", 'any'::"text"]))),
    CONSTRAINT "symptom_refinements_override_risk_level_check" CHECK ((("override_risk_level" IS NULL) OR ("override_risk_level" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text"]))))
);


ALTER TABLE "public"."symptom_refinements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."symptoms" (
    "key" "text" NOT NULL,
    "label" "text" NOT NULL,
    "icon" "text" NOT NULL
);


ALTER TABLE "public"."symptoms" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tools" (
    "key" "text" NOT NULL,
    "label" "text" NOT NULL,
    "category" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."tools" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vehicles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "year" integer NOT NULL,
    "make" "text" NOT NULL,
    "model" "text" NOT NULL,
    "nickname" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."vehicles" OWNER TO "postgres";


ALTER TABLE ONLY "public"."education_cards"
    ADD CONSTRAINT "education_cards_pkey" PRIMARY KEY ("symptom_key", "card_key");



ALTER TABLE ONLY "public"."education_cards"
    ADD CONSTRAINT "education_cards_symptom_card_unique" UNIQUE ("symptom_key", "card_key");



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mechanic_profiles"
    ADD CONSTRAINT "mechanic_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_auth_id_key" UNIQUE ("auth_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_auth_id_unique" UNIQUE ("auth_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quote_requests"
    ADD CONSTRAINT "quote_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quotes"
    ADD CONSTRAINT "quotes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."safety_measures"
    ADD CONSTRAINT "safety_measures_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."skills"
    ADD CONSTRAINT "skills_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."symptom_education"
    ADD CONSTRAINT "symptom_education_pkey" PRIMARY KEY ("symptom_key");



ALTER TABLE ONLY "public"."symptom_mappings"
    ADD CONSTRAINT "symptom_mappings_id_unique" UNIQUE ("id");



ALTER TABLE ONLY "public"."symptom_mappings"
    ADD CONSTRAINT "symptom_mappings_pkey" PRIMARY KEY ("symptom_key");



ALTER TABLE ONLY "public"."symptom_mappings"
    ADD CONSTRAINT "symptom_mappings_symptom_key_unique" UNIQUE ("symptom_key");



ALTER TABLE ONLY "public"."symptom_question_options"
    ADD CONSTRAINT "symptom_question_options_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."symptom_questions"
    ADD CONSTRAINT "symptom_questions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."symptom_questions"
    ADD CONSTRAINT "symptom_questions_symptom_key_question_key_key" UNIQUE ("symptom_key", "question_key");



ALTER TABLE ONLY "public"."symptom_questions"
    ADD CONSTRAINT "symptom_questions_unique_key" UNIQUE ("symptom_key", "question_key");



ALTER TABLE ONLY "public"."symptom_refinements"
    ADD CONSTRAINT "symptom_refinements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."symptom_refinements"
    ADD CONSTRAINT "symptom_refinements_symptom_key_question_key_match_type_mat_key" UNIQUE ("symptom_key", "question_key", "match_type", "match_value");



ALTER TABLE ONLY "public"."symptoms"
    ADD CONSTRAINT "symptoms_key_unique" UNIQUE ("key");



ALTER TABLE ONLY "public"."symptoms"
    ADD CONSTRAINT "symptoms_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."tools"
    ADD CONSTRAINT "tools_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."vehicles"
    ADD CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_jobs_accepted_mechanic_created" ON "public"."jobs" USING "btree" ("accepted_mechanic_id", "created_at" DESC) WHERE ("accepted_mechanic_id" IS NOT NULL);



CREATE INDEX "idx_jobs_accepted_mechanic_id" ON "public"."jobs" USING "btree" ("accepted_mechanic_id");



CREATE INDEX "idx_jobs_canceled_at" ON "public"."jobs" USING "btree" ("canceled_at") WHERE ("canceled_at" IS NOT NULL);



CREATE INDEX "idx_jobs_created_at" ON "public"."jobs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_jobs_customer_id" ON "public"."jobs" USING "btree" ("customer_id");



CREATE INDEX "idx_jobs_customer_status_created" ON "public"."jobs" USING "btree" ("customer_id", "status", "created_at" DESC);



CREATE INDEX "idx_jobs_status" ON "public"."jobs" USING "btree" ("status");



CREATE INDEX "idx_jobs_status_created" ON "public"."jobs" USING "btree" ("status", "created_at" DESC) WHERE ("status" = 'searching'::"public"."job_status");



CREATE INDEX "idx_jobs_vehicle_id" ON "public"."jobs" USING "btree" ("vehicle_id");



CREATE INDEX "idx_mechanic_profiles_is_available" ON "public"."mechanic_profiles" USING "btree" ("is_available");



CREATE INDEX "idx_mechanic_profiles_is_verified" ON "public"."mechanic_profiles" USING "btree" ("is_verified");



CREATE INDEX "idx_mechanic_profiles_location" ON "public"."mechanic_profiles" USING "btree" ("base_location_lat", "base_location_lng");



CREATE INDEX "idx_messages_job_id" ON "public"."messages" USING "btree" ("job_id", "created_at" DESC);



CREATE INDEX "idx_messages_recipient_unread" ON "public"."messages" USING "btree" ("recipient_id", "read_at");



CREATE INDEX "idx_messages_sender_id" ON "public"."messages" USING "btree" ("sender_id");



CREATE INDEX "idx_profiles_id_status" ON "public"."profiles" USING "btree" ("id_status");



CREATE INDEX "idx_profiles_id_verified_at" ON "public"."profiles" USING "btree" ("id_verified_at");



CREATE INDEX "idx_profiles_public_card" ON "public"."profiles" USING "btree" ("id", "deleted_at") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_quote_requests_accepted_at" ON "public"."quote_requests" USING "btree" ("accepted_at") WHERE ("accepted_at" IS NOT NULL);



CREATE INDEX "idx_quote_requests_canceled_at" ON "public"."quote_requests" USING "btree" ("canceled_at") WHERE ("canceled_at" IS NOT NULL);



CREATE INDEX "idx_quote_requests_customer_created" ON "public"."quote_requests" USING "btree" ("customer_id", "created_at" DESC);



CREATE INDEX "idx_quote_requests_customer_id" ON "public"."quote_requests" USING "btree" ("customer_id");



CREATE INDEX "idx_quote_requests_job_id" ON "public"."quote_requests" USING "btree" ("job_id");



CREATE INDEX "idx_quote_requests_job_status" ON "public"."quote_requests" USING "btree" ("job_id", "status");



CREATE INDEX "idx_quote_requests_mechanic_created" ON "public"."quote_requests" USING "btree" ("mechanic_id", "created_at" DESC);



CREATE INDEX "idx_quote_requests_mechanic_id" ON "public"."quote_requests" USING "btree" ("mechanic_id");



CREATE INDEX "idx_quote_requests_status" ON "public"."quote_requests" USING "btree" ("status");



CREATE INDEX "idx_quote_requests_status_created" ON "public"."quote_requests" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "idx_quotes_job_id" ON "public"."quotes" USING "btree" ("job_id");



CREATE INDEX "idx_quotes_mechanic_id" ON "public"."quotes" USING "btree" ("mechanic_id");



CREATE INDEX "idx_quotes_status" ON "public"."quotes" USING "btree" ("status");



CREATE INDEX "idx_symptom_mappings_category" ON "public"."symptom_mappings" USING "btree" ("category");



CREATE INDEX "idx_symptom_mappings_id" ON "public"."symptom_mappings" USING "btree" ("id");



CREATE INDEX "idx_symptom_mappings_risk_level" ON "public"."symptom_mappings" USING "btree" ("risk_level");



CREATE INDEX "idx_symptom_questions_affects_quote" ON "public"."symptom_questions" USING "btree" ("affects_quote");



CREATE INDEX "idx_symptom_questions_affects_safety" ON "public"."symptom_questions" USING "btree" ("affects_safety");



CREATE INDEX "idx_symptom_questions_symptom_key" ON "public"."symptom_questions" USING "btree" ("symptom_key");



CREATE INDEX "idx_symptom_refinements_active_priority" ON "public"."symptom_refinements" USING "btree" ("is_active", "priority");



CREATE INDEX "idx_symptom_refinements_question" ON "public"."symptom_refinements" USING "btree" ("question_key");



CREATE INDEX "idx_symptom_refinements_symptom" ON "public"."symptom_refinements" USING "btree" ("symptom_key");



CREATE INDEX "idx_vehicles_customer_created" ON "public"."vehicles" USING "btree" ("customer_id", "created_at" DESC);



CREATE INDEX "idx_vehicles_customer_id" ON "public"."vehicles" USING "btree" ("customer_id");



CREATE INDEX "idx_vehicles_id_customer_id" ON "public"."vehicles" USING "btree" ("id", "customer_id");



CREATE INDEX "profiles_email_idx" ON "public"."profiles" USING "btree" ("email");



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."quotes" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."vehicles" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "trg_symptom_mappings_updated_at" BEFORE UPDATE ON "public"."symptom_mappings" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_symptom_questions_updated_at" BEFORE UPDATE ON "public"."symptom_questions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_symptom_refinements_updated_at" BEFORE UPDATE ON "public"."symptom_refinements" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_accepted_mechanic_id_fkey" FOREIGN KEY ("accepted_mechanic_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."mechanic_profiles"
    ADD CONSTRAINT "mechanic_profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_auth_id_fkey" FOREIGN KEY ("auth_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quote_requests"
    ADD CONSTRAINT "quote_requests_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quote_requests"
    ADD CONSTRAINT "quote_requests_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quote_requests"
    ADD CONSTRAINT "quote_requests_mechanic_id_fkey" FOREIGN KEY ("mechanic_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quotes"
    ADD CONSTRAINT "quotes_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quotes"
    ADD CONSTRAINT "quotes_mechanic_id_fkey" FOREIGN KEY ("mechanic_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."symptom_education"
    ADD CONSTRAINT "symptom_education_symptom_key_fkey" FOREIGN KEY ("symptom_key") REFERENCES "public"."symptoms"("key") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."symptom_mappings"
    ADD CONSTRAINT "symptom_mappings_symptom_key_fkey" FOREIGN KEY ("symptom_key") REFERENCES "public"."symptoms"("key") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."symptom_question_options"
    ADD CONSTRAINT "symptom_question_options_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."symptom_questions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."symptom_questions"
    ADD CONSTRAINT "symptom_questions_symptom_key_fkey" FOREIGN KEY ("symptom_key") REFERENCES "public"."symptom_mappings"("symptom_key") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."vehicles"
    ADD CONSTRAINT "vehicles_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Anyone can view verified mechanic profiles" ON "public"."mechanic_profiles" FOR SELECT USING (("is_verified" = true));



CREATE POLICY "Assigned mechanics can update their jobs" ON "public"."jobs" FOR UPDATE USING (("auth"."uid"() = "accepted_mechanic_id"));



CREATE POLICY "Assigned mechanics can view their jobs" ON "public"."jobs" FOR SELECT USING (("auth"."uid"() = "accepted_mechanic_id"));



CREATE POLICY "Customers can delete own vehicles" ON "public"."vehicles" FOR DELETE USING (("auth"."uid"() = "customer_id"));



CREATE POLICY "Customers can insert jobs" ON "public"."jobs" FOR INSERT WITH CHECK (("auth"."uid"() = "customer_id"));



CREATE POLICY "Customers can insert jobs with their vehicles" ON "public"."jobs" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "customer_id") AND (("vehicle_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."vehicles"
  WHERE (("vehicles"."id" = "jobs"."vehicle_id") AND ("vehicles"."customer_id" = "auth"."uid"())))))));



CREATE POLICY "Customers can insert own vehicles" ON "public"."vehicles" FOR INSERT WITH CHECK (("auth"."uid"() = "customer_id"));



CREATE POLICY "Customers can update own vehicles" ON "public"."vehicles" FOR UPDATE USING (("auth"."uid"() = "customer_id"));



CREATE POLICY "Customers can update quote requests for their jobs" ON "public"."quote_requests" FOR UPDATE USING (("auth"."uid"() = "customer_id"));



CREATE POLICY "Customers can update their own jobs" ON "public"."jobs" FOR UPDATE TO "authenticated" USING (("customer_id" = "auth"."uid"())) WITH CHECK ((("customer_id" = "auth"."uid"()) AND (("canceled_at" IS NULL) OR ("canceled_at" = ( SELECT "jobs_1"."canceled_at"
   FROM "public"."jobs" "jobs_1"
  WHERE ("jobs_1"."id" = "jobs_1"."id"))))));



COMMENT ON POLICY "Customers can update their own jobs" ON "public"."jobs" IS 'Allows customers to update their jobs, but prevents direct modification of cancellation fields (must use cancel_quote_by_customer RPC)';



CREATE POLICY "Customers can update their own quote requests" ON "public"."quote_requests" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."jobs"
  WHERE (("jobs"."id" = "quote_requests"."job_id") AND ("jobs"."customer_id" = "auth"."uid"()))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."jobs"
  WHERE (("jobs"."id" = "quote_requests"."job_id") AND ("jobs"."customer_id" = "auth"."uid"())))) AND (("canceled_at" IS NULL) OR ("canceled_at" = ( SELECT "quote_requests_1"."canceled_at"
   FROM "public"."quote_requests" "quote_requests_1"
  WHERE ("quote_requests_1"."id" = "quote_requests_1"."id"))))));



COMMENT ON POLICY "Customers can update their own quote requests" ON "public"."quote_requests" IS 'Allows customers to update quotes for their jobs, but prevents direct modification of cancellation fields (must use cancel_quote_by_customer RPC)';



CREATE POLICY "Customers can view own vehicles" ON "public"."vehicles" FOR SELECT USING (("auth"."uid"() = "customer_id"));



CREATE POLICY "Customers can view quote requests for their jobs" ON "public"."quote_requests" FOR SELECT USING (("auth"."uid"() = "customer_id"));



CREATE POLICY "Customers can view quotes for their jobs" ON "public"."quote_requests" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."jobs"
  WHERE (("jobs"."id" = "quote_requests"."job_id") AND ("jobs"."customer_id" = "auth"."uid"())))));



COMMENT ON POLICY "Customers can view quotes for their jobs" ON "public"."quote_requests" IS 'Allows customers to view all quotes for their jobs, including cancellation information';



CREATE POLICY "Customers can view quotes for their jobs" ON "public"."quotes" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."jobs"
  WHERE (("jobs"."id" = "quotes"."job_id") AND ("jobs"."customer_id" = "auth"."uid"())))));



CREATE POLICY "Customers can view their own jobs" ON "public"."jobs" FOR SELECT USING (("auth"."uid"() = "customer_id"));



CREATE POLICY "Mechanics can create quotes" ON "public"."quotes" FOR INSERT WITH CHECK (("auth"."uid"() = "mechanic_id"));



CREATE POLICY "Mechanics can insert quote requests" ON "public"."quote_requests" FOR INSERT WITH CHECK (("auth"."uid"() = "mechanic_id"));



CREATE POLICY "Mechanics can insert their own profile" ON "public"."mechanic_profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Mechanics can update their own profile" ON "public"."mechanic_profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Mechanics can update their own quote requests" ON "public"."quote_requests" FOR UPDATE TO "authenticated" USING (("mechanic_id" = "auth"."uid"())) WITH CHECK ((("mechanic_id" = "auth"."uid"()) AND (("canceled_by" IS NULL) OR ("canceled_by" <> 'customer'::"text") OR ("canceled_by" = ( SELECT "quote_requests_1"."canceled_by"
   FROM "public"."quote_requests" "quote_requests_1"
  WHERE ("quote_requests_1"."id" = "quote_requests_1"."id"))))));



COMMENT ON POLICY "Mechanics can update their own quote requests" ON "public"."quote_requests" IS 'Allows mechanics to update their quotes, but prevents modification of customer cancellation fields';



CREATE POLICY "Mechanics can update their own quotes" ON "public"."quotes" FOR UPDATE USING (("auth"."uid"() = "mechanic_id"));



CREATE POLICY "Mechanics can view all mechanic profiles" ON "public"."mechanic_profiles" FOR SELECT USING (true);



CREATE POLICY "Mechanics can view searching jobs" ON "public"."jobs" FOR SELECT USING (("status" = 'searching'::"public"."job_status"));



CREATE POLICY "Mechanics can view their own quote requests" ON "public"."quote_requests" FOR SELECT USING (("auth"."uid"() = "mechanic_id"));



CREATE POLICY "Mechanics can view their own quotes" ON "public"."quote_requests" FOR SELECT TO "authenticated" USING (("mechanic_id" = "auth"."uid"()));



COMMENT ON POLICY "Mechanics can view their own quotes" ON "public"."quote_requests" IS 'Allows mechanics to view their quotes, including cancellation information when canceled by customer';



CREATE POLICY "Mechanics can view their own quotes" ON "public"."quotes" FOR SELECT USING (("auth"."uid"() = "mechanic_id"));



CREATE POLICY "Users can insert messages for their jobs" ON "public"."messages" FOR INSERT WITH CHECK ((("auth"."uid"() = "sender_id") AND (EXISTS ( SELECT 1
   FROM "public"."jobs"
  WHERE (("jobs"."id" = "messages"."job_id") AND (("jobs"."customer_id" = "auth"."uid"()) OR ("jobs"."accepted_mechanic_id" = "auth"."uid"())))))));



CREATE POLICY "Users can update their own messages" ON "public"."messages" FOR UPDATE USING (("auth"."uid"() = "sender_id"));



CREATE POLICY "Users can view messages for their jobs" ON "public"."messages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."jobs"
  WHERE (("jobs"."id" = "messages"."job_id") AND (("jobs"."customer_id" = "auth"."uid"()) OR ("jobs"."accepted_mechanic_id" = "auth"."uid"()))))));



ALTER TABLE "public"."jobs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "jobs_delete_customer_owner" ON "public"."jobs" FOR DELETE TO "authenticated" USING (("customer_id" = "auth"."uid"()));



CREATE POLICY "jobs_insert_customer_owner" ON "public"."jobs" FOR INSERT TO "authenticated" WITH CHECK (("customer_id" = "auth"."uid"()));



CREATE POLICY "jobs_select_owner_or_assigned_or_searching" ON "public"."jobs" FOR SELECT TO "authenticated" USING ((("customer_id" = "auth"."uid"()) OR ("accepted_mechanic_id" = "auth"."uid"()) OR ("status" = 'searching'::"public"."job_status")));



CREATE POLICY "jobs_update_owner_or_assigned" ON "public"."jobs" FOR UPDATE TO "authenticated" USING ((("customer_id" = "auth"."uid"()) OR ("accepted_mechanic_id" = "auth"."uid"()))) WITH CHECK ((("customer_id" = "auth"."uid"()) OR ("accepted_mechanic_id" = "auth"."uid"())));



ALTER TABLE "public"."mechanic_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profile readable" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "auth_id"));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_insert_own" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "auth_id"));



CREATE POLICY "profiles_insert_system" ON "public"."profiles" FOR INSERT WITH CHECK (true);



CREATE POLICY "profiles_read_own" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "profiles_select_own" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "auth_id"));



CREATE POLICY "profiles_update_own" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "auth_id")) WITH CHECK (("auth"."uid"() = "auth_id"));



ALTER TABLE "public"."quote_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "quote_requests_delete_mechanic" ON "public"."quote_requests" FOR DELETE TO "authenticated" USING (("mechanic_id" = "auth"."uid"()));



CREATE POLICY "quote_requests_insert_mechanic" ON "public"."quote_requests" FOR INSERT TO "authenticated" WITH CHECK (("mechanic_id" = "auth"."uid"()));



CREATE POLICY "quote_requests_select_participants" ON "public"."quote_requests" FOR SELECT TO "authenticated" USING ((("customer_id" = "auth"."uid"()) OR ("mechanic_id" = "auth"."uid"())));



CREATE POLICY "quote_requests_update_participants" ON "public"."quote_requests" FOR UPDATE TO "authenticated" USING ((("customer_id" = "auth"."uid"()) OR ("mechanic_id" = "auth"."uid"()))) WITH CHECK ((("customer_id" = "auth"."uid"()) OR ("mechanic_id" = "auth"."uid"())));



ALTER TABLE "public"."quotes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "read symptom mappings" ON "public"."symptom_mappings" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "read symptoms" ON "public"."symptoms" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."symptom_mappings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "symptom_mappings_public_read" ON "public"."symptom_mappings" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "public"."symptom_questions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "symptom_questions_public_read" ON "public"."symptom_questions" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "public"."vehicles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "vehicles_delete_customer_owner" ON "public"."vehicles" FOR DELETE TO "authenticated" USING (("customer_id" = "auth"."uid"()));



CREATE POLICY "vehicles_insert_customer_owner" ON "public"."vehicles" FOR INSERT TO "authenticated" WITH CHECK (("customer_id" = "auth"."uid"()));



CREATE POLICY "vehicles_select_customer_owner" ON "public"."vehicles" FOR SELECT TO "authenticated" USING (("customer_id" = "auth"."uid"()));



CREATE POLICY "vehicles_select_mechanic_jobs" ON "public"."vehicles" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."jobs" "j"
     JOIN "public"."quote_requests" "qr" ON (("qr"."job_id" = "j"."id")))
  WHERE (("j"."vehicle_id" = "vehicles"."id") AND ("qr"."mechanic_id" = "auth"."uid"())))));



CREATE POLICY "vehicles_update_customer_owner" ON "public"."vehicles" FOR UPDATE TO "authenticated" USING (("customer_id" = "auth"."uid"())) WITH CHECK (("customer_id" = "auth"."uid"()));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";









GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."block_blocklisted_email_signup"() TO "anon";
GRANT ALL ON FUNCTION "public"."block_blocklisted_email_signup"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."block_blocklisted_email_signup"() TO "service_role";



GRANT ALL ON FUNCTION "public"."block_deleted_profile_access"() TO "anon";
GRANT ALL ON FUNCTION "public"."block_deleted_profile_access"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."block_deleted_profile_access"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cancel_quote_by_customer"("p_quote_id" "uuid", "p_reason" "text", "p_note" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."cancel_quote_by_customer"("p_quote_id" "uuid", "p_reason" "text", "p_note" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cancel_quote_by_customer"("p_quote_id" "uuid", "p_reason" "text", "p_note" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_email_not_blocked"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_email_not_blocked"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_email_not_blocked"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_user_not_deleted"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_user_not_deleted"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_user_not_deleted"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_public_profile_card"("user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_public_profile_card"("user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_public_profile_card"("user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";


















GRANT ALL ON TABLE "public"."education_cards" TO "anon";
GRANT ALL ON TABLE "public"."education_cards" TO "authenticated";
GRANT ALL ON TABLE "public"."education_cards" TO "service_role";



GRANT ALL ON TABLE "public"."jobs" TO "anon";
GRANT ALL ON TABLE "public"."jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."jobs" TO "service_role";



GRANT ALL ON TABLE "public"."mechanic_profiles" TO "anon";
GRANT ALL ON TABLE "public"."mechanic_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."mechanic_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."quote_requests" TO "anon";
GRANT ALL ON TABLE "public"."quote_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."quote_requests" TO "service_role";



GRANT ALL ON TABLE "public"."quotes" TO "anon";
GRANT ALL ON TABLE "public"."quotes" TO "authenticated";
GRANT ALL ON TABLE "public"."quotes" TO "service_role";



GRANT ALL ON TABLE "public"."safety_measures" TO "anon";
GRANT ALL ON TABLE "public"."safety_measures" TO "authenticated";
GRANT ALL ON TABLE "public"."safety_measures" TO "service_role";



GRANT ALL ON TABLE "public"."skills" TO "anon";
GRANT ALL ON TABLE "public"."skills" TO "authenticated";
GRANT ALL ON TABLE "public"."skills" TO "service_role";



GRANT ALL ON TABLE "public"."symptom_education" TO "anon";
GRANT ALL ON TABLE "public"."symptom_education" TO "authenticated";
GRANT ALL ON TABLE "public"."symptom_education" TO "service_role";



GRANT ALL ON TABLE "public"."symptom_mappings" TO "anon";
GRANT ALL ON TABLE "public"."symptom_mappings" TO "authenticated";
GRANT ALL ON TABLE "public"."symptom_mappings" TO "service_role";



GRANT ALL ON TABLE "public"."symptom_question_options" TO "anon";
GRANT ALL ON TABLE "public"."symptom_question_options" TO "authenticated";
GRANT ALL ON TABLE "public"."symptom_question_options" TO "service_role";



GRANT ALL ON TABLE "public"."symptom_questions" TO "anon";
GRANT ALL ON TABLE "public"."symptom_questions" TO "authenticated";
GRANT ALL ON TABLE "public"."symptom_questions" TO "service_role";



GRANT ALL ON TABLE "public"."symptom_refinements" TO "anon";
GRANT ALL ON TABLE "public"."symptom_refinements" TO "authenticated";
GRANT ALL ON TABLE "public"."symptom_refinements" TO "service_role";



GRANT ALL ON TABLE "public"."symptoms" TO "anon";
GRANT ALL ON TABLE "public"."symptoms" TO "authenticated";
GRANT ALL ON TABLE "public"."symptoms" TO "service_role";



GRANT ALL ON TABLE "public"."tools" TO "anon";
GRANT ALL ON TABLE "public"."tools" TO "authenticated";
GRANT ALL ON TABLE "public"."tools" TO "service_role";



GRANT ALL ON TABLE "public"."vehicles" TO "anon";
GRANT ALL ON TABLE "public"."vehicles" TO "authenticated";
GRANT ALL ON TABLE "public"."vehicles" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































