-- Migration 0064: Rating Prompt System
-- Tracks user rating prompt state for in-app review prompts and push reminders

SET search_path TO public, extensions;

CREATE TABLE IF NOT EXISTS public.user_rating_prompt_state (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  has_rated boolean DEFAULT false NOT NULL,
  first_job_completed_at timestamptz,
  last_prompt_at timestamptz,
  prompt_count integer DEFAULT 0 NOT NULL,
  snooze_until timestamptz,
  last_push_at timestamptz,
  push_count integer DEFAULT 0 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_rating_prompt_user ON user_rating_prompt_state(user_id);
CREATE INDEX idx_rating_prompt_eligible ON user_rating_prompt_state(has_rated, snooze_until, push_count) 
  WHERE has_rated = false;

ALTER TABLE user_rating_prompt_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rating_state_own" ON user_rating_prompt_state;
CREATE POLICY "rating_state_own" ON user_rating_prompt_state
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE ON user_rating_prompt_state TO authenticated;
GRANT ALL ON user_rating_prompt_state TO service_role;

CREATE OR REPLACE FUNCTION update_rating_prompt_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS rating_prompt_updated_at ON user_rating_prompt_state;
CREATE TRIGGER rating_prompt_updated_at
  BEFORE UPDATE ON user_rating_prompt_state
  FOR EACH ROW EXECUTE FUNCTION update_rating_prompt_timestamp();

CREATE OR REPLACE FUNCTION on_job_completed_rating_prompt()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    INSERT INTO user_rating_prompt_state (user_id, first_job_completed_at)
    VALUES (NEW.customer_id, now())
    ON CONFLICT (user_id) DO UPDATE
    SET first_job_completed_at = COALESCE(user_rating_prompt_state.first_job_completed_at, now()),
        updated_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS job_completed_rating_prompt ON jobs;
CREATE TRIGGER job_completed_rating_prompt
  AFTER INSERT OR UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION on_job_completed_rating_prompt();

CREATE OR REPLACE FUNCTION get_rating_prompt_eligibility(p_user_id uuid)
RETURNS TABLE (
  eligible boolean,
  reason text,
  prompt_number integer,
  days_since_last_prompt integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_state user_rating_prompt_state%ROWTYPE;
  v_completed_jobs integer;
  v_days_since_last integer;
  v_required_days integer;
BEGIN
  SELECT * INTO v_state FROM user_rating_prompt_state WHERE user_id = p_user_id;
  
  IF v_state IS NULL THEN
    RETURN QUERY SELECT false, 'no_state'::text, 0, 0;
    RETURN;
  END IF;
  
  IF v_state.has_rated THEN
    RETURN QUERY SELECT false, 'already_rated'::text, v_state.prompt_count, 0;
    RETURN;
  END IF;
  
  IF v_state.first_job_completed_at IS NULL THEN
    RETURN QUERY SELECT false, 'no_completed_job'::text, 0, 0;
    RETURN;
  END IF;
  
  IF v_state.snooze_until IS NOT NULL AND now() < v_state.snooze_until THEN
    RETURN QUERY SELECT false, 'snoozed'::text, v_state.prompt_count, 0;
    RETURN;
  END IF;
  
  IF v_state.prompt_count >= 3 THEN
    RETURN QUERY SELECT false, 'max_prompts_reached'::text, v_state.prompt_count, 0;
    RETURN;
  END IF;
  
  IF v_state.last_prompt_at IS NULL THEN
    RETURN QUERY SELECT true, 'first_prompt'::text, 1, 0;
    RETURN;
  END IF;
  
  v_days_since_last := EXTRACT(DAY FROM (now() - v_state.last_prompt_at))::integer;
  
  CASE v_state.prompt_count
    WHEN 1 THEN v_required_days := 7;
    WHEN 2 THEN v_required_days := 30;
    ELSE v_required_days := 999;
  END CASE;
  
  IF v_days_since_last >= v_required_days THEN
    RETURN QUERY SELECT true, 'cadence_met'::text, v_state.prompt_count + 1, v_days_since_last;
  ELSE
    RETURN QUERY SELECT false, 'cadence_not_met'::text, v_state.prompt_count, v_days_since_last;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION get_rating_prompt_eligibility TO authenticated;

CREATE OR REPLACE FUNCTION record_rating_prompt(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE user_rating_prompt_state
  SET last_prompt_at = now(),
      prompt_count = prompt_count + 1,
      snooze_until = NULL
  WHERE user_id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION record_rating_prompt TO authenticated;

CREATE OR REPLACE FUNCTION snooze_rating_prompt(p_user_id uuid, p_days integer DEFAULT 14)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE user_rating_prompt_state
  SET snooze_until = now() + (p_days || ' days')::interval
  WHERE user_id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION snooze_rating_prompt TO authenticated;

CREATE OR REPLACE FUNCTION confirm_app_rated(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE user_rating_prompt_state
  SET has_rated = true,
      snooze_until = NULL
  WHERE user_id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION confirm_app_rated TO authenticated;

CREATE OR REPLACE FUNCTION get_push_eligible_users()
RETURNS TABLE (
  user_id uuid,
  push_token text,
  push_number integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    rps.user_id,
    p.push_token,
    rps.push_count + 1 as push_number
  FROM user_rating_prompt_state rps
  INNER JOIN profiles p ON p.id = rps.user_id
  WHERE rps.has_rated = false
    AND rps.first_job_completed_at IS NOT NULL
    AND rps.prompt_count > 0
    AND rps.push_count < 3
    AND p.push_token IS NOT NULL
    AND p.deleted_at IS NULL
    AND (rps.snooze_until IS NULL OR now() > rps.snooze_until)
    AND (
      (rps.push_count = 0 AND rps.last_prompt_at < now() - interval '3 days')
      OR (rps.push_count = 1 AND rps.last_push_at < now() - interval '14 days')
      OR (rps.push_count = 2 AND rps.last_push_at < now() - interval '45 days')
    );
END;
$$;

GRANT EXECUTE ON FUNCTION get_push_eligible_users TO service_role;

CREATE OR REPLACE FUNCTION record_rating_push(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE user_rating_prompt_state
  SET last_push_at = now(),
      push_count = push_count + 1
  WHERE user_id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION record_rating_push TO service_role;

COMMENT ON TABLE user_rating_prompt_state IS 'Tracks app rating prompt state per user for in-app reviews and push reminders';
