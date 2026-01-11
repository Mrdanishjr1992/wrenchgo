-- Create get_public_profile_card RPC function
-- Returns public profile data for displaying in quotes flow

CREATE OR REPLACE FUNCTION public.get_public_profile_card(user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
  profile_record record;
  ratings_data jsonb;
  badges_data jsonb;
  skills_data jsonb;
  trust_data jsonb;
BEGIN
  -- Get basic profile info
  SELECT 
    p.id,
    p.role,
    COALESCE(p.display_name, p.full_name, 'User') as display_name,
    p.avatar_url,
    p.created_at
  INTO profile_record
  FROM public.profiles p
  WHERE p.id = user_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Get ratings (aggregate from reviews)
  SELECT jsonb_build_object(
    'overall_avg', COALESCE(AVG(r.overall_rating), 0),
    'performance_avg', COALESCE(AVG(r.performance_rating), 0),
    'timing_avg', COALESCE(AVG(r.timing_rating), 0),
    'cost_avg', COALESCE(AVG(r.cost_rating), 0),
    'professionalism_avg', COALESCE(AVG(r.professionalism_rating), 0),
    'communication_avg', COALESCE(AVG(r.communication_rating), 0),
    'punctuality_avg', COALESCE(AVG(r.punctuality_rating), 0),
    'payment_avg', COALESCE(AVG(r.payment_rating), 0),
    'review_count', COUNT(r.id),
    'would_recommend_count', COUNT(CASE WHEN r.would_recommend THEN 1 END),
    'would_recommend_total', COUNT(CASE WHEN r.would_recommend IS NOT NULL THEN 1 END)
  ) INTO ratings_data
  FROM public.reviews r
  WHERE r.reviewee_id = user_id;

  -- Get badges
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', ub.id,
      'badge_id', ub.badge_id,
      'awarded_at', ub.awarded_at,
      'badge', jsonb_build_object(
        'code', b.code,
        'title', b.title,
        'description', b.description,
        'icon', b.icon,
        'category', b.category,
        'tier', b.tier
      )
    )
  ), '[]'::jsonb) INTO badges_data
  FROM public.user_badges ub
  JOIN public.badges b ON b.id = ub.badge_id
  WHERE ub.user_id = user_id;

  -- Get skills (for mechanics)
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', ms.id,
      'skill', jsonb_build_object(
        'key', s.key,
        'label', COALESCE(s.label, s.name),
        'name', s.name,
        'category', s.category
      ),
      'is_verified', ms.is_verified,
      'verified_job_count', COALESCE(ms.verified_job_count, 0),
      'avg_job_rating', ms.avg_job_rating
    )
  ), '[]'::jsonb) INTO skills_data
  FROM public.mechanic_skills ms
  JOIN public.skills s ON s.id = ms.skill_id
  WHERE ms.mechanic_id = user_id;

  -- Calculate trust score
  SELECT jsonb_build_object(
    'overall_score', 50, -- Default score
    'rating_score', COALESCE((ratings_data->>'overall_avg')::numeric * 10, 0),
    'completion_score', 50,
    'reliability_score', 50,
    'badge_score', LEAST(jsonb_array_length(badges_data) * 5, 50),
    'tenure_score', LEAST(EXTRACT(DAYS FROM (now() - profile_record.created_at)) / 30 * 5, 50),
    'completed_jobs', 0,
    'total_jobs', 0
  ) INTO trust_data;

  -- Build final result
  result := jsonb_build_object(
    'id', profile_record.id,
    'role', profile_record.role,
    'display_name', profile_record.display_name,
    'avatar_url', profile_record.avatar_url,
    'created_at', profile_record.created_at,
    'ratings', COALESCE(ratings_data, '{}'::jsonb),
    'badges', COALESCE(badges_data, '[]'::jsonb),
    'skills', COALESCE(skills_data, '[]'::jsonb),
    'trust_score', COALESCE(trust_data, '{}'::jsonb)
  );

  RETURN result;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_public_profile_card(uuid) TO authenticated;
