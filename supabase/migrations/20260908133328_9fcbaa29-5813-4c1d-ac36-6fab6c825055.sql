CREATE TABLE public.user_backups (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data_key TEXT NOT NULL,
  value JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, data_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_backups TO authenticated;
GRANT ALL ON public.user_backups TO service_role;

ALTER TABLE public.user_backups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own backups"
ON public.user_backups FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_user_backups_updated_at
BEFORE UPDATE ON public.user_backups
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();