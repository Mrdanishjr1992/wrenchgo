-- MIGRATION 0032: INVITE SYSTEM & LAUNCH DASHBOARD
-- Ring-based invite logic with kill switch

-- 1. Update waitlist with invite tracking
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS status VARCHAR(20) 
  DEFAULT 'waiting' CHECK (status IN ('waiting', 'invited', 'active', 'expired'));
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS invite_expires_at TIMESTAMPTZ;
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS invite_code VARCHAR(32);
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_waitlist_status ON waitlist(status);
CREATE INDEX IF NOT EXISTS idx_waitlist_invite_expires ON waitlist(invite_expires_at) WHERE status = 'invited';

-- 2. Invite batches table (audit trail)
CREATE TABLE IF NOT EXISTS invite_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hub_id UUID REFERENCES service_hubs(id) NOT NULL,
  ring INTEGER NOT NULL,
  user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('customer', 'mechanic')),
  batch_size INTEGER NOT NULL,
  invited_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);

-- 3. Launch dashboard metrics (daily snapshot)
CREATE TABLE IF NOT EXISTS launch_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hub_id UUID REFERENCES service_hubs(id) NOT NULL,
  date DATE NOT NULL,
  -- Supply metrics
  active_mechanics INTEGER DEFAULT 0,
  new_mechanics INTEGER DEFAULT 0,
  -- Demand metrics
  jobs_requested INTEGER DEFAULT 0,
  jobs_completed INTEGER DEFAULT 0,
  -- Response metrics
  median_response_minutes INTEGER,
  p90_response_minutes INTEGER,
  -- Fulfillment
  completion_rate DECIMAL(5,2),
  -- Utilization
  jobs_per_mechanic DECIMAL(5,2),
  -- Ring distribution
  ring_0_jobs INTEGER DEFAULT 0,
  ring_1_jobs INTEGER DEFAULT 0,
  ring_2_jobs INTEGER DEFAULT 0,
  ring_3_jobs INTEGER DEFAULT 0,
  -- Support signals
  no_shows INTEGER DEFAULT 0,
  late_arrivals INTEGER DEFAULT 0,
  cancellations INTEGER DEFAULT 0,
  complaints INTEGER DEFAULT 0,
  -- Computed health
  health_score INTEGER, -- 0-100
  can_expand BOOLEAN DEFAULT false,
  UNIQUE(hub_id, date)
);

CREATE INDEX IF NOT EXISTS idx_launch_metrics_hub_date ON launch_metrics(hub_id, date DESC);

-- 4. Function: Check if hub can expand to next ring
CREATE OR REPLACE FUNCTION can_expand_ring(p_hub_id UUID)
RETURNS TABLE(
  can_expand BOOLEAN,
  current_ring INTEGER,
  next_ring INTEGER,
  blockers TEXT[],
  metrics JSONB
) AS $$
DECLARE
  hub RECORD;
  last_7d RECORD;
  current_r INTEGER;
  next_r INTEGER;
  blocks TEXT[] := '{}';
BEGIN
  -- Get hub info
  SELECT * INTO hub FROM service_hubs WHERE id = p_hub_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 0, ARRAY['Hub not found']::TEXT[], '{}'::JSONB;
    RETURN;
  END IF;
  
  -- Calculate current ring from active radius
  current_r := CASE 
    WHEN hub.active_radius_miles <= 25 THEN 0
    WHEN hub.active_radius_miles <= 50 THEN 1
    WHEN hub.active_radius_miles <= 75 THEN 2
    ELSE 3
  END;
  next_r := LEAST(current_r + 1, 3);
  
  -- Get last 7 days metrics
  SELECT 
    AVG(median_response_minutes) as avg_response,
    AVG(completion_rate) as avg_completion,
    SUM(active_mechanics) / NULLIF(COUNT(*), 0) as avg_mechanics,
    SUM(complaints) as total_complaints,
    SUM(no_shows) as total_no_shows
  INTO last_7d
  FROM launch_metrics
  WHERE hub_id = p_hub_id AND date >= CURRENT_DATE - 7;
  
  -- Check blockers
  IF last_7d.avg_response IS NULL THEN
    blocks := array_append(blocks, 'No metrics data yet');
  ELSIF last_7d.avg_response > 20 THEN
    blocks := array_append(blocks, 'Response time > 20 min (' || ROUND(last_7d.avg_response) || ' min)');
  END IF;
  
  IF last_7d.avg_completion IS NOT NULL AND last_7d.avg_completion < 75 THEN
    blocks := array_append(blocks, 'Completion rate < 75% (' || ROUND(last_7d.avg_completion) || '%)');
  END IF;
  
  IF last_7d.total_complaints > 5 THEN
    blocks := array_append(blocks, 'Too many complaints (' || last_7d.total_complaints || ')');
  END IF;
  
  IF last_7d.total_no_shows > 3 THEN
    blocks := array_append(blocks, 'Too many no-shows (' || last_7d.total_no_shows || ')');
  END IF;
  
  IF current_r >= 3 THEN
    blocks := array_append(blocks, 'Already at max ring');
  END IF;
  
  RETURN QUERY SELECT
    array_length(blocks, 1) IS NULL OR array_length(blocks, 1) = 0,
    current_r,
    next_r,
    blocks,
    jsonb_build_object(
      'avg_response_minutes', ROUND(last_7d.avg_response),
      'avg_completion_rate', ROUND(last_7d.avg_completion),
      'avg_active_mechanics', ROUND(last_7d.avg_mechanics),
      'total_complaints', last_7d.total_complaints,
      'total_no_shows', last_7d.total_no_shows
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 5. Function: Send invites for a ring (mechanics first)
CREATE OR REPLACE FUNCTION send_ring_invites(
  p_hub_id UUID,
  p_ring INTEGER,
  p_user_type VARCHAR(20),
  p_batch_size INTEGER DEFAULT 10,
  p_created_by UUID DEFAULT NULL
) RETURNS TABLE(
  invited_count INTEGER,
  invite_batch_id UUID
) AS $$
DECLARE
  batch_id UUID;
  count INTEGER := 0;
  invite_code VARCHAR(32);
  w RECORD;
BEGIN
  -- Validate batch size
  IF p_batch_size > 25 THEN
    p_batch_size := 25;
  END IF;
  
  -- Create batch record
  INSERT INTO invite_batches (hub_id, ring, user_type, batch_size, created_by)
  VALUES (p_hub_id, p_ring, p_user_type, p_batch_size, p_created_by)
  RETURNING id INTO batch_id;
  
  -- Send invites
  FOR w IN 
    SELECT id FROM waitlist
    WHERE nearest_hub_id = p_hub_id
    AND ring = p_ring
    AND user_type = p_user_type
    AND status = 'waiting'
    ORDER BY created_at ASC
    LIMIT p_batch_size
  LOOP
    invite_code := encode(gen_random_bytes(16), 'hex');
    
    UPDATE waitlist SET
      status = 'invited',
      invited_at = NOW(),
      invite_expires_at = NOW() + INTERVAL '72 hours',
      invite_code = invite_code
    WHERE id = w.id;
    
    count := count + 1;
  END LOOP;
  
  -- Update batch with actual count
  UPDATE invite_batches SET invited_count = count WHERE id = batch_id;
  
  RETURN QUERY SELECT count, batch_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Function: Expire old invites
CREATE OR REPLACE FUNCTION expire_old_invites()
RETURNS INTEGER AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  UPDATE waitlist
  SET status = 'expired'
  WHERE status = 'invited'
  AND invite_expires_at < NOW();
  
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Function: Accept invite
CREATE OR REPLACE FUNCTION accept_invite(p_invite_code VARCHAR(32))
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  user_type VARCHAR,
  hub_name VARCHAR
) AS $$
DECLARE
  w RECORD;
  h RECORD;
BEGIN
  SELECT * INTO w FROM waitlist WHERE invite_code = p_invite_code;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Invalid invite code'::TEXT, NULL::VARCHAR, NULL::VARCHAR;
    RETURN;
  END IF;
  
  IF w.status = 'expired' THEN
    RETURN QUERY SELECT false, 'This invite has expired'::TEXT, NULL::VARCHAR, NULL::VARCHAR;
    RETURN;
  END IF;
  
  IF w.status = 'active' THEN
    RETURN QUERY SELECT false, 'This invite has already been used'::TEXT, NULL::VARCHAR, NULL::VARCHAR;
    RETURN;
  END IF;
  
  IF w.invite_expires_at < NOW() THEN
    UPDATE waitlist SET status = 'expired' WHERE id = w.id;
    RETURN QUERY SELECT false, 'This invite has expired'::TEXT, NULL::VARCHAR, NULL::VARCHAR;
    RETURN;
  END IF;
  
  -- Accept the invite
  UPDATE waitlist SET
    status = 'active',
    accepted_at = NOW()
  WHERE id = w.id;
  
  SELECT name INTO h FROM service_hubs WHERE id = w.nearest_hub_id;
  
  RETURN QUERY SELECT true, 'Welcome! Your account is now active.'::TEXT, w.user_type, h.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Dashboard view: Current hub health
DROP VIEW IF EXISTS hub_health_dashboard;
CREATE VIEW hub_health_dashboard AS
SELECT 
  h.id as hub_id,
  h.name as hub_name,
  h.active_radius_miles,
  h.max_radius_miles,
  h.invite_only,
  CASE 
    WHEN h.active_radius_miles <= 25 THEN 0
    WHEN h.active_radius_miles <= 50 THEN 1
    WHEN h.active_radius_miles <= 75 THEN 2
    ELSE 3
  END as current_ring,
  -- Last 7 days
  ROUND(AVG(m.median_response_minutes)) as avg_response_7d,
  ROUND(AVG(m.completion_rate)) as avg_completion_7d,
  SUM(m.jobs_requested) as jobs_7d,
  SUM(m.jobs_completed) as completed_7d,
  ROUND(AVG(m.active_mechanics)) as avg_mechanics_7d,
  ROUND(AVG(m.jobs_per_mechanic), 1) as utilization_7d,
  SUM(m.complaints) as complaints_7d,
  SUM(m.no_shows) as no_shows_7d,
  -- Waitlist by ring
  (SELECT COUNT(*) FROM waitlist w WHERE w.nearest_hub_id = h.id AND w.ring = 0 AND w.status = 'waiting') as ring_0_waiting,
  (SELECT COUNT(*) FROM waitlist w WHERE w.nearest_hub_id = h.id AND w.ring = 1 AND w.status = 'waiting') as ring_1_waiting,
  (SELECT COUNT(*) FROM waitlist w WHERE w.nearest_hub_id = h.id AND w.ring = 2 AND w.status = 'waiting') as ring_2_waiting,
  (SELECT COUNT(*) FROM waitlist w WHERE w.nearest_hub_id = h.id AND w.ring = 3 AND w.status = 'waiting') as ring_3_waiting,
  -- Health assessment
  CASE
    WHEN AVG(m.median_response_minutes) > 25 THEN 'RED'
    WHEN AVG(m.median_response_minutes) > 15 THEN 'YELLOW'
    ELSE 'GREEN'
  END as response_health,
  CASE
    WHEN AVG(m.completion_rate) < 70 THEN 'RED'
    WHEN AVG(m.completion_rate) < 75 THEN 'YELLOW'
    ELSE 'GREEN'
  END as completion_health
FROM service_hubs h
LEFT JOIN launch_metrics m ON m.hub_id = h.id AND m.date >= CURRENT_DATE - 7
WHERE h.is_active = true
GROUP BY h.id, h.name, h.active_radius_miles, h.max_radius_miles, h.invite_only;

-- 9. Grant permissions
GRANT SELECT ON invite_batches TO authenticated;
GRANT SELECT ON launch_metrics TO authenticated;
GRANT SELECT ON hub_health_dashboard TO authenticated;
GRANT EXECUTE ON FUNCTION can_expand_ring TO authenticated;
GRANT EXECUTE ON FUNCTION send_ring_invites TO authenticated;
GRANT EXECUTE ON FUNCTION expire_old_invites TO authenticated;
GRANT EXECUTE ON FUNCTION accept_invite TO anon, authenticated;

COMMENT ON FUNCTION can_expand_ring IS 'Check if hub metrics allow expanding to next ring';
COMMENT ON FUNCTION send_ring_invites IS 'Send batch invites for a specific ring (mechanics first!)';
COMMENT ON FUNCTION accept_invite IS 'Accept an invite code and activate user';
COMMENT ON VIEW hub_health_dashboard IS 'Real-time hub health for launch decisions';
