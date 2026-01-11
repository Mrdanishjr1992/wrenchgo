-- Fix phone number detection to catch plain 10-digit numbers

CREATE OR REPLACE FUNCTION public.detect_contact_info(message_text text)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  patterns_found text[] := '{}';
  risk_score numeric := 0;
BEGIN
  -- Phone number patterns - including plain 10-digit numbers
  IF message_text ~* '(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}' 
     OR message_text ~* '\b\d{10}\b' THEN
    patterns_found := array_append(patterns_found, 'phone');
    risk_score := risk_score + 30;
  END IF;
  
  -- Email patterns
  IF message_text ~* '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}' THEN
    patterns_found := array_append(patterns_found, 'email');
    risk_score := risk_score + 30;
  END IF;
  
  -- Social media patterns
  IF message_text ~* '(instagram|facebook|whatsapp|telegram|snapchat|twitter|tiktok)[\s:@]?[\w.]+' THEN
    patterns_found := array_append(patterns_found, 'social');
    risk_score := risk_score + 25;
  END IF;
  
  -- URL patterns
  IF message_text ~* '(https?://|www\.)[^\s]+' THEN
    patterns_found := array_append(patterns_found, 'url');
    risk_score := risk_score + 20;
  END IF;
  
  -- Obfuscation patterns - spaced digits
  IF message_text ~* '\d[\s.]{1,3}\d[\s.]{1,3}\d[\s.]{1,3}\d[\s.]{1,3}\d' THEN
    patterns_found := array_append(patterns_found, 'obfuscated_phone');
    risk_score := risk_score + 40;
  END IF;
  
  -- Obfuscation patterns - word numbers
  IF message_text ~* '(zero|one|two|three|four|five|six|seven|eight|nine)[\s-]+(zero|one|two|three|four|five|six|seven|eight|nine)' THEN
    patterns_found := array_append(patterns_found, 'obfuscated_numbers');
    risk_score := risk_score + 35;
  END IF;
  
  -- Obfuscation patterns - at/dot
  IF message_text ~* '(\bat\b|\[at\]|\(at\)).*(\bdot\b|\[dot\]|\(dot\))' THEN
    patterns_found := array_append(patterns_found, 'obfuscated_email');
    risk_score := risk_score + 35;
  END IF;
  
  RETURN jsonb_build_object(
    'patterns_detected', patterns_found,
    'risk_score', LEAST(risk_score, 100),
    'has_contact_info', array_length(patterns_found, 1) > 0
  );
END;
$$;