
-- Table to store school credentials for admin reference
CREATE TABLE public.school_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text NOT NULL,
  password_plain text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.school_credentials ENABLE ROW LEVEL SECURITY;

-- Only admins can view credentials
CREATE POLICY "Admins can view credentials"
ON public.school_credentials
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can insert credentials
CREATE POLICY "Admins can insert credentials"
ON public.school_credentials
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Only admins can delete credentials
CREATE POLICY "Admins can delete credentials"
ON public.school_credentials
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));
