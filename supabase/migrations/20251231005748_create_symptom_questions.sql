-- Enable RLS (safe to run multiple times)
ALTER TABLE public.symptom_questions ENABLE ROW LEVEL SECURITY;

-- Re-create policy safely
DROP POLICY IF EXISTS "Allow public read access to symptom_questions"
  ON public.symptom_questions;

CREATE POLICY "Allow public read access to symptom_questions"
  ON public.symptom_questions
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- (optional but usually needed)
GRANT SELECT ON public.symptom_questions TO anon, authenticated;
