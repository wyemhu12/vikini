ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own files" ON public.files;
CREATE POLICY "Users manage own files" ON public.files
  FOR ALL USING (auth.jwt() ->> 'email' = user_id);
