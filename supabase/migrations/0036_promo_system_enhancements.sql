-- PROMO SYSTEM ENHANCEMENTS - SCHEMA

CREATE TABLE IF NOT EXISTS public.platform_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value_cents int,
  value_percent numeric,
  description text,
  effective_from timestamptz DEFAULT now() NOT NULL,
  effective_until timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

INSERT INTO public.platform_pricing (key, value_percent, value_cents, description) VALUES
  ('platform_fee_percent', 10.00, NULL, 'Platform fee as percentage of quote')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.platform_pricing (key, value_percent, value_cents, description) VALUES
  ('min_platform_fee_cents', NULL, 500, 'Minimum platform fee in cents')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.platform_pricing (key, value_percent, value_cents, description) VALUES
  ('max_platform_fee_cents', NULL, 10000, 'Maximum platform fee in cents')
ON CONFLICT (key) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_platform_pricing_key_effective 
  ON public.platform_pricing(key, effective_from) 
  WHERE effective_until IS NULL;

ALTER TABLE public.promotions 
  ADD COLUMN IF NOT EXISTS redemption_paused boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS pause_reason text,
  ADD COLUMN IF NOT EXISTS terms_text text,
  ADD COLUMN IF NOT EXISTS terms_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS max_total_discount_cents int,
  ADD COLUMN IF NOT EXISTS current_total_discount_cents int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS applies_to text DEFAULT 'platform_fee',
  ADD COLUMN IF NOT EXISTS max_discount_cents int,
  ADD COLUMN IF NOT EXISTS sunset_at timestamptz,
  ADD COLUMN IF NOT EXISTS sunset_reason text,
  ADD COLUMN IF NOT EXISTS grant_paused boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS grant_pause_reason text,
  ADD COLUMN IF NOT EXISTS user_segment text DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS priority int DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_promotions_financial_exposure 
  ON public.promotions(max_total_discount_cents, current_total_discount_cents) 
  WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_promotions_sunset 
  ON public.promotions(sunset_at) 
  WHERE sunset_at IS NOT NULL AND active = true;

ALTER TABLE public.promo_credits
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS paused boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS pause_reason text,
  ADD COLUMN IF NOT EXISTS max_discount_cents int,
  ADD COLUMN IF NOT EXISTS promotion_id uuid REFERENCES public.promotions(id);

CREATE INDEX IF NOT EXISTS idx_promo_credits_expires 
  ON public.promo_credits(expires_at) 
  WHERE expires_at IS NOT NULL AND remaining_uses > 0;

ALTER TABLE public.promotion_redemptions
  ADD COLUMN IF NOT EXISTS discount_cents int,
  ADD COLUMN IF NOT EXISTS quote_amount_cents int,
  ADD COLUMN IF NOT EXISTS platform_fee_cents int,
  ADD COLUMN IF NOT EXISTS discount_type text,
  ADD COLUMN IF NOT EXISTS idempotency_key text UNIQUE;

CREATE INDEX IF NOT EXISTS idx_promotion_redemptions_idempotency 
  ON public.promotion_redemptions(idempotency_key) 
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE public.platform_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY platform_pricing_select ON public.platform_pricing
  FOR SELECT USING (true);

GRANT SELECT ON public.platform_pricing TO authenticated;
